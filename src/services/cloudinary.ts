import { createHash } from 'crypto';
import { readImageSize } from './imageProbe';

export interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const clean = (v?: string) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

/** Baca kredensial dari CLOUDINARY_URL (format dashboard) atau tiga variabel terpisah. */
export function getCloudinaryCreds(): CloudinaryCreds | null {
  const url = clean(process.env.CLOUDINARY_URL);
  if (url) {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url);
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(process.env.CLOUDINARY_API_KEY);
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Tanda tangan Cloudinary: parameter diurutkan alfabet, digabung "k=v&k=v", ditambah secret, di-SHA1. */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(base + secret).digest('hex');
}

function friendlyError(status: number, msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid signature')) return 'Cloudinary: tanda tangan tidak cocok. API Secret salah atau ada spasi/kutip tersisa di environment variable.';
  if (m.includes('unknown api key') || m.includes('invalid api_key') || m.includes('invalid api key')) return 'Cloudinary: API Key tidak dikenal. Periksa CLOUDINARY_API_KEY.';
  if (m.includes('cloud_name') || status === 404) return 'Cloudinary: Cloud name salah atau akun dinonaktifkan. Periksa CLOUDINARY_CLOUD_NAME (nama di dashboard, bukan email/username).';
  if (m.includes('disabled') || status === 403) return `Cloudinary menolak akses: ${msg}`;
  return `Cloudinary: ${msg || `status ${status}`}`;
}

/** Cek kredensial tanpa mengunggah apa pun. */
export async function pingCloudinary(c: CloudinaryCreds): Promise<{ ok: boolean; message: string }> {
  try {
    const auth = Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloudName)}/ping`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && j.status === 'ok') return { ok: true, message: `Terhubung ke cloud "${c.cloudName}".` };
    return { ok: false, message: friendlyError(r.status, j?.error?.message || '') };
  } catch (e: any) {
    return { ok: false, message: `Tidak bisa menjangkau Cloudinary: ${e?.message || e}` };
  }
}

export const UPLOAD = { width: 1280, height: 720, maxBytes: 400 * 1024, folder: 'qiraat-ads' };

/** Terima data URL JPEG/PNG/WebP dari form, validasi ukuran, lalu unggah ke Cloudinary dari server. */
export async function uploadDataUrl(dataUrl: string, c: CloudinaryCreds): Promise<{ url: string; width: number; height: number }> {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Format gambar harus JPG, PNG, atau WebP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > UPLOAD.maxBytes) throw new Error(`Gambar ${Math.round(buf.length / 1024)} KB melebihi batas ${UPLOAD.maxBytes / 1024} KB.`);
  const size = readImageSize(buf);
  if (!size) throw new Error('File tidak terbaca sebagai gambar.');
  if (size.width !== UPLOAD.width || size.height !== UPLOAD.height) {
    throw new Error(`Ukuran harus ${UPLOAD.width}x${UPLOAD.height}px (diterima ${size.width}x${size.height}).`);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ folder: UPLOAD.folder, timestamp }, c.apiSecret);
  const fd = new FormData();
  fd.append('file', dataUrl);
  fd.append('api_key', c.apiKey);
  fd.append('timestamp', String(timestamp));
  fd.append('folder', UPLOAD.folder);
  fd.append('signature', signature);

  let r: Response;
  try {
    r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloudName)}/image/upload`, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(25000),
    });
  } catch (e: any) {
    throw new Error(`Tidak bisa menjangkau Cloudinary: ${e?.message || e}`);
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.secure_url) throw new Error(friendlyError(r.status, j?.error?.message || ''));
  return { url: j.secure_url, width: j.width ?? size.width, height: j.height ?? size.height };
}
