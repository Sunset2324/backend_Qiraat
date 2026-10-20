import axios from 'axios';
import dns from 'dns/promises';
import net from 'net';

export interface ProbeResult {
  width: number;
  height: number;
  type: 'jpeg' | 'png' | 'webp' | 'gif';
  contentType: string;
}

export class ProbeError extends Error {}

// ---------- Baca ukuran gambar dari byte awal file (tanpa library) ----------
export function readImageSize(b: Buffer): { width: number; height: number; type: ProbeResult['type'] } | null {
  // PNG
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF') {
    return { type: 'gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // WebP
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = b.toString('ascii', 12, 16);
    if (fmt === 'VP8 ') {
      return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    }
    if (fmt === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (fmt === 'VP8X') {
      return { type: 'webp', width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
    return null;
  }
  // JPEG: cari marker SOFn
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// ---------- Cegah SSRF: tolak alamat internal ----------
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

async function assertPublicHost(host: string) {
  if (process.env.ADS_ALLOW_PRIVATE === '1') return; // hanya untuk uji lokal
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new ProbeError('Alamat itu bukan server publik.');
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new ProbeError(`Domain "${host}" tidak ditemukan. Periksa penulisan URL.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new ProbeError('Alamat itu bukan server publik.');
  }
}

const hintForHost = (host: string): string => {
  if (/(^|\.)drive\.google\.com$/.test(host) || /(^|\.)photos\.google\.com$/.test(host) || host === 'photos.app.goo.gl') {
    return ' Link Google Drive/Photos bukan link gambar langsung; unggah lewat mode Upload atau pakai hosting gambar (Cloudinary, Imgur, dll).';
  }
  return '';
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Ambil sebagian awal gambar dari URL dan baca ukurannya. Pesan error dibuat agar jelas bagi admin. */
export async function probeImageUrl(rawUrl: string): Promise<ProbeResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ProbeError('URL tidak valid.');
  }
  if (url.protocol !== 'https:') throw new ProbeError('URL gambar harus diawali https://');

  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url.hostname);
    let res;
    try {
      res = await axios.get(url.toString(), {
        responseType: 'stream',
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5' },
      });
    } catch (e: any) {
      const code = e?.code;
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') throw new ProbeError('Server gambar terlalu lama merespons (timeout).');
      throw new ProbeError(`Tidak bisa terhubung ke ${url.hostname} (${code || e?.message || 'error'}).`);
    }

    const status = res.status;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.data.destroy();
      try {
        url = new URL(String(res.headers.location), url);
      } catch {
        throw new ProbeError('Pengalihan (redirect) URL tidak valid.');
      }
      if (url.protocol !== 'https:') throw new ProbeError('URL dialihkan ke alamat non-https.');
      continue;
    }
    if (status < 200 || status >= 300) {
      res.data.destroy();
      const why =
        status === 403 || status === 401
          ? 'Server menolak akses (kemungkinan hotlink diblokir).'
          : status === 404
          ? 'Gambar tidak ditemukan (404).'
          : `Server menjawab status ${status}.`;
      throw new ProbeError(`${why}${hintForHost(url.hostname)}`);
    }

    const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType.startsWith('text/html') || contentType.includes('xml')) {
      res.data.destroy();
      throw new ProbeError(
        `URL itu halaman web, bukan file gambar. Buka gambarnya lalu pilih "Salin alamat gambar" (Copy image address).${hintForHost(url.hostname)}`
      );
    }

    // Baca bagian awal file sampai ukuran terbaca (maks 1 MB).
    const size = await new Promise<{ width: number; height: number; type: ProbeResult['type'] } | null>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let done = false;
      const finish = (v: any, err?: Error) => {
        if (done) return;
        done = true;
        res.data.destroy();
        err ? reject(err) : resolve(v);
      };
      res.data.on('data', (c: Buffer) => {
        chunks.push(c);
        total += c.length;
        const parsed = readImageSize(Buffer.concat(chunks));
        if (parsed) return finish(parsed);
        if (total > 1_000_000) finish(null);
      });
      res.data.on('end', () => finish(readImageSize(Buffer.concat(chunks))));
      res.data.on('error', (e: Error) => finish(null, new ProbeError(`Gagal membaca gambar: ${e.message}`)));
      setTimeout(() => finish(null, new ProbeError('Pengunduhan gambar terlalu lama.')), 12000);
    });

    if (!size || !size.width || !size.height) {
      throw new ProbeError(
        `File itu tidak terbaca sebagai gambar JPG/PNG/WebP/GIF${contentType ? ` (tipe: ${contentType})` : ''}.${hintForHost(url.hostname)}`
      );
    }
    return { ...size, contentType };
  }
  throw new ProbeError('Terlalu banyak pengalihan (redirect) pada URL ini.');
}
