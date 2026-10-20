import { Request, Response } from 'express';
import { AdsService, AdInput, storeMode, pingStore } from '../services/ads.service';
import { probeImageUrl, ProbeError } from '../services/imageProbe';
import { getCloudinaryCreds, pingCloudinary, uploadDataUrl, UPLOAD } from '../services/cloudinary';
import temaRaw from '../data/temaMedis.json';

interface TemaRow { k: string; no: number; tema: string; s: number; a: number }
const TEMA = temaRaw as TemaRow[];

// Aturan gambar iklan (dipakai form admin dan divalidasi ulang di server).
export const IMAGE_RULE = {
  ratioW: 16, ratioH: 9,
  uploadWidth: UPLOAD.width, uploadHeight: UPLOAD.height,
  minWidth: 960, maxBytes: UPLOAD.maxBytes,
};

const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  try {
    return new URL(u.trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

type Fields = Omit<AdInput, 'imageWidth' | 'imageHeight'>;

function parseInput(body: any): { ok: true; data: Fields } | { ok: false; message: string } {
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const ctaLabel = String(body?.ctaLabel ?? '').trim() || 'Lihat Produk';
  const tema = String(body?.tema ?? '').trim();
  const surah = Number(body?.surah);
  const ayat = Number(body?.ayat);
  const order = Number.isFinite(Number(body?.order)) ? Number(body.order) : 0;

  if (!title || title.length > 80) return { ok: false, message: 'Judul wajib diisi (maks 80 karakter).' };
  if (description.length > 220) return { ok: false, message: 'Deskripsi maks 220 karakter.' };
  if (ctaLabel.length > 24) return { ok: false, message: 'Label tombol maks 24 karakter.' };
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return { ok: false, message: 'Surah tidak valid.' };
  if (!Number.isInteger(ayat) || ayat < 1) return { ok: false, message: 'Ayat tidak valid.' };
  if (!isHttps(body?.imageUrl)) return { ok: false, message: 'URL gambar harus https.' };
  if (!isHttps(body?.productUrl)) return { ok: false, message: 'Link produk harus https.' };

  return {
    ok: true,
    data: {
      title, description, ctaLabel, tema, surah, ayat,
      imageUrl: String(body.imageUrl).trim(),
      productUrl: String(body.productUrl).trim(),
      active: body?.active !== false,
      order,
    },
  };
}

/** Ukuran gambar dibaca ulang oleh server (tidak percaya angka dari browser). */
async function resolveImage(url: string, known?: { imageUrl: string; imageWidth: number; imageHeight: number }) {
  if (known && known.imageUrl === url && known.imageWidth > 0) {
    return { width: known.imageWidth, height: known.imageHeight };
  }
  const p = await probeImageUrl(url);
  if (Math.abs(p.width / p.height - IMAGE_RULE.ratioW / IMAGE_RULE.ratioH) > 0.03) {
    throw new ProbeError(`Rasio gambar ${p.width}x${p.height} bukan 16:9.`);
  }
  if (p.width < IMAGE_RULE.minWidth) {
    throw new ProbeError(`Lebar gambar ${p.width}px kurang dari minimal ${IMAGE_RULE.minWidth}px.`);
  }
  return { width: p.width, height: p.height };
}

const fail = (res: Response, e: any) => {
  console.error('ADS ERROR:', e?.message);
  const status = e instanceof ProbeError ? 400 : 500;
  res.status(status).json({ success: false, message: e?.message || 'Terjadi kesalahan.' });
};

export const AdsController = {
  // Publik: dipakai app.
  async publicList(_req: Request, res: Response) {
    try {
      const data = (await AdsService.listActive()).map(({ createdAt, updatedAt, active, order, ...rest }) => rest);
      res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
      res.json({ success: true, data });
    } catch (e) {
      fail(res, e);
    }
  },

  // Admin
  async adminConfig(_req: Request, res: Response) {
    res.json({
      success: true,
      data: { store: storeMode(), cloudinary: !!getCloudinaryCreds(), rule: IMAGE_RULE, tema: TEMA },
    });
  },
  /** Cek koneksi Upstash dan Cloudinary, lengkap dengan alasan kalau gagal. */
  async diagnose(_req: Request, res: Response) {
    const creds = getCloudinaryCreds();
    const [store, cloud] = await Promise.all([
      pingStore(),
      creds
        ? pingCloudinary(creds)
        : Promise.resolve({
            ok: false,
            message: 'Variabel Cloudinary belum lengkap. Isi CLOUDINARY_URL, atau CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET, lalu Redeploy.',
          }),
    ]);
    res.json({ success: true, data: { store, cloudinary: cloud } });
  },
  async probeImage(req: Request, res: Response) {
    try {
      const url = String(req.body?.url ?? '');
      const p = await probeImageUrl(url);
      const ratioOk = Math.abs(p.width / p.height - IMAGE_RULE.ratioW / IMAGE_RULE.ratioH) <= 0.03;
      const widthOk = p.width >= IMAGE_RULE.minWidth;
      res.json({ success: true, data: { width: p.width, height: p.height, type: p.type, ratioOk, widthOk } });
    } catch (e) {
      fail(res, e);
    }
  },
  async upload(req: Request, res: Response) {
    try {
      const creds = getCloudinaryCreds();
      if (!creds) return res.status(503).json({ success: false, message: 'Cloudinary belum dikonfigurasi di server.' });
      const out = await uploadDataUrl(String(req.body?.dataUrl ?? ''), creds);
      res.json({ success: true, data: out });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e?.message || 'Upload gagal.' });
    }
  },
  async adminList(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: await AdsService.listAll() });
    } catch (e) {
      fail(res, e);
    }
  },
  async adminCreate(req: Request, res: Response) {
    try {
      const p = parseInput(req.body);
      if (!p.ok) return res.status(400).json({ success: false, message: p.message });
      const dim = await resolveImage(p.data.imageUrl);
      const ad = await AdsService.create({ ...p.data, imageWidth: dim.width, imageHeight: dim.height });
      res.status(201).json({ success: true, data: ad });
    } catch (e) {
      fail(res, e);
    }
  },
  async adminUpdate(req: Request, res: Response) {
    try {
      const p = parseInput(req.body);
      if (!p.ok) return res.status(400).json({ success: false, message: p.message });
      const id = String(req.params.id);
      const existing = (await AdsService.listAll()).find((a) => a.id === id);
      if (!existing) return res.status(404).json({ success: false, message: 'Iklan tidak ditemukan.' });
      const dim = await resolveImage(p.data.imageUrl, existing);
      const ad = await AdsService.update(id, { ...p.data, imageWidth: dim.width, imageHeight: dim.height });
      if (!ad) return res.status(404).json({ success: false, message: 'Iklan tidak ditemukan.' });
      res.json({ success: true, data: ad });
    } catch (e) {
      fail(res, e);
    }
  },
  async adminDelete(req: Request, res: Response) {
    try {
      const ok = await AdsService.remove(String(req.params.id));
      if (!ok) return res.status(404).json({ success: false, message: 'Iklan tidak ditemukan.' });
      res.json({ success: true });
    } catch (e) {
      fail(res, e);
    }
  },
};
