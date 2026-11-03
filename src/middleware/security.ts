import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import axios from 'axios';

// ============================================================================
// Lapisan keamanan backend: header keamanan, CORS allowlist, rate limit, dan
// pembatas percobaan login admin. Tanpa dependensi baru.
//
// Env (semua opsional):
//   CORS_ORIGINS      daftar origin browser yang diizinkan, pisah koma.
//                     Default: https://alqiraat.app,https://www.alqiraat.app
//   TRUST_PROXY_HOPS  jumlah proxy tepercaya di depan server (default 1). Dipakai membaca IP klien
//                     dari X-Forwarded-For. 0 = jangan percaya header itu (pakai alamat koneksi).
//   UPSTASH_REDIS_REST_URL / _TOKEN  (kalau ada) penghitung rate limit dibagi antar instance server.
// ============================================================================

const envClean = (v?: string) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

// ---------- IP klien ----------
/**
 * IP klien yang tidak bisa dipalsukan lewat header X-Forwarded-For buatan penyerang:
 * proxy tepercaya menambahkan IP koneksi di UJUNG daftar, jadi kita ambil dari belakang
 * sebanyak jumlah proxy tepercaya, bukan entri pertama.
 */
export function clientIp(req: Request): string {
  const hops = Math.max(0, parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10) || 0);
  const socketIp = req.socket?.remoteAddress ?? 'unknown';
  if (hops === 0) return socketIp;
  const xff = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!xff.length) return socketIp;
  return xff[Math.max(0, xff.length - hops)];
}

// ---------- Penghitung (Upstash bila ada, memori bila tidak) ----------
const URL_ = envClean(process.env.UPSTASH_REDIS_REST_URL);
const TOKEN = envClean(process.env.UPSTASH_REDIS_REST_TOKEN);
const useRedis = () => !!(URL_ && TOKEN);

type Bucket = { n: number; resetAt: number };
const mem = new Map<string, Bucket>();

/** Naikkan penghitung `key` dalam jendela waktu; kembalikan jumlah sekarang dan sisa detik jendela. */
async function bump(key: string, windowMs: number): Promise<{ n: number; retryAfter: number }> {
  if (useRedis()) {
    try {
      const k = `qiraat:rl:${key}`;
      const pipe = (cmds: (string | number)[][]) =>
        axios.post(URL_.replace(/\/$/, '') + '/pipeline', cmds, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 3000,
        });
      const r = await pipe([['INCR', k], ['PTTL', k]]);
      const n = Number(r.data?.[0]?.result);
      let pttl = Number(r.data?.[1]?.result);
      if (Number.isFinite(n)) {
        if (!(pttl > 0)) {
          // kunci baru (atau tanpa kedaluwarsa): pasang jendela waktunya
          await pipe([['PEXPIRE', k, windowMs]]);
          pttl = windowMs;
        }
        return { n, retryAfter: Math.max(1, Math.ceil(pttl / 1000)) };
      }
    } catch {
      /* Redis gagal: jatuh ke memori supaya situs tidak mati */
    }
  }
  const now = Date.now();
  let b = mem.get(key);
  if (!b || b.resetAt <= now) {
    b = { n: 0, resetAt: now + windowMs };
    mem.set(key, b);
  }
  b.n++;
  if (mem.size > 20000) {
    for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k); // bersihkan yang kedaluwarsa saja
  }
  return { n: b.n, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

/** Baca penghitung tanpa menaikkannya (dipakai pemeriksaan blokir login). */
async function peek(key: string): Promise<{ n: number; retryAfter: number }> {
  if (useRedis()) {
    try {
      const k = `qiraat:rl:${key}`;
      const r = await axios.post(URL_.replace(/\/$/, '') + '/pipeline', [['GET', k], ['PTTL', k]], {
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 3000,
      });
      const n = Number(r.data?.[0]?.result ?? 0);
      const pttl = Number(r.data?.[1]?.result ?? 0);
      return { n: Number.isFinite(n) ? n : 0, retryAfter: Math.max(1, Math.ceil(Math.max(pttl, 0) / 1000)) };
    } catch {
      /* jatuh ke memori */
    }
  }
  const b = mem.get(key);
  if (!b || b.resetAt <= Date.now()) return { n: 0, retryAfter: 0 };
  return { n: b.n, retryAfter: Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000)) };
}

// ---------- Rate limit umum ----------
export const rateLimit =
  (name: string, max: number, windowMs: number) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const { n, retryAfter } = await bump(`${name}:${clientIp(req)}`, windowMs);
    if (n > max) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'Terlalu banyak permintaan, coba lagi nanti.' });
    }
    next();
  };

// ---------- Login admin: blokir sementara setelah gagal berulang ----------
const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60 * 1000;

/** Pasang SEBELUM adminAuth. Setelah 5 kunci salah dalam 15 menit, IP itu diblokir sampai jendela habis. */
export const adminLoginGuard = async (req: Request, res: Response, next: NextFunction) => {
  const ip = clientIp(req);
  const { n, retryAfter } = await peek(`adminfail:${ip}`);
  if (n >= FAIL_MAX) {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.` });
  }
  res.on('finish', () => {
    if (res.statusCode === 401) void bump(`adminfail:${ip}`, FAIL_WINDOW);
  });
  next();
};

// ---------- Header keamanan ----------
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.removeHeader('X-Powered-By');
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=15552000', // 180 hari; tanpa includeSubDomains (aman bagi subdomain lain)
    // Respons API (JSON/gambar) tidak perlu menjalankan apa pun di browser
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  next();
};

/** Kirim halaman admin dengan CSP ketat: skrip hanya yang bertanda nonce acak per permintaan. */
export function sendAdminHtml(res: Response, html: string) {
  const nonce = randomBytes(16).toString('base64');
  const body = html.replace('<script>', `<script nonce="${nonce}">`);
  res.set({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'unsafe-inline'", // halaman memakai atribut style; skrip tetap dikunci nonce
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join('; '),
  });
  res.type('html').send(body);
}

// ---------- CORS allowlist ----------
const DEFAULT_ORIGINS = ['https://alqiraat.app', 'https://www.alqiraat.app'];
const allowedOrigins = (): string[] => {
  const raw = envClean(process.env.CORS_ORIGINS);
  return raw ? raw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean) : DEFAULT_ORIGINS;
};

/** Origin browser yang tidak ada di daftar tidak diberi izin CORS. Aplikasi native (tanpa Origin) tidak terpengaruh. */
export const corsOptions = {
  origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
    if (!origin) return cb(null, true);
    cb(null, allowedOrigins().includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key'],
  maxAge: 600,
};

// ---------- Peringatan kunci admin lemah (dicatat di log server saat start) ----------
export function warnWeakAdminKey() {
  const k = envClean(process.env.ADMIN_KEY);
  if (!k) console.warn('[security] ADMIN_KEY belum diatur: halaman admin tidak bisa dipakai.');
  else if (k.length < 24) console.warn(`[security] ADMIN_KEY hanya ${k.length} karakter. Pakai minimal 24 karakter acak.`);
}
