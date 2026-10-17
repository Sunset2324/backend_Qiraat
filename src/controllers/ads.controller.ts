import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { AdsService, AdInput, storeMode } from '../services/ads.service';
import temaRaw from '../data/temaMedis.json';

interface TemaRow { k: string; no: number; tema: string; s: number; a: number }
const TEMA = temaRaw as TemaRow[];

// Aturan gambar iklan (dipakai form admin dan divalidasi ulang di server).
export const IMAGE_RULE = { ratioW: 16, ratioH: 9, uploadWidth: 1280, uploadHeight: 720, minWidth: 960, maxBytes: 400 * 1024 };

const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

function parseInput(body: any): { ok: true; data: AdInput } | { ok: false; message: string } {
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const ctaLabel = String(body?.ctaLabel ?? '').trim() || 'Lihat Produk';
  const tema = String(body?.tema ?? '').trim();
  const surah = Number(body?.surah);
  const ayat = Number(body?.ayat);
  const w = Number(body?.imageWidth);
  const h = Number(body?.imageHeight);
  const order = Number.isFinite(Number(body?.order)) ? Number(body.order) : 0;

  if (!title || title.length > 80) return { ok: false, message: 'Judul wajib diisi (maks 80 karakter).' };
  if (description.length > 220) return { ok: false, message: 'Deskripsi maks 220 karakter.' };
  if (ctaLabel.length > 24) return { ok: false, message: 'Label tombol maks 24 karakter.' };
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return { ok: false, message: 'Surah tidak valid.' };
  if (!Number.isInteger(ayat) || ayat < 1) return { ok: false, message: 'Ayat tidak valid.' };
  if (!isHttps(body?.imageUrl)) return { ok: false, message: 'URL gambar harus https.' };
  if (!isHttps(body?.productUrl)) return { ok: false, message: 'Link produk harus https.' };
  if (!(w > 0 && h > 0)) return { ok: false, message: 'Ukuran gambar tidak terbaca.' };
  if (Math.abs(w / h - IMAGE_RULE.ratioW / IMAGE_RULE.ratioH) > 0.03) {
    return { ok: false, message: 'Rasio gambar harus 16:9.' };
  }
  if (w < IMAGE_RULE.minWidth) return { ok: false, message: `Lebar gambar minimal ${IMAGE_RULE.minWidth}px.` };

  return {
    ok: true,
    data: {
      title, description, ctaLabel, tema, surah, ayat,
      imageUrl: body.imageUrl, imageWidth: Math.round(w), imageHeight: Math.round(h),
      productUrl: body.productUrl,
      active: body?.active !== false,
      order,
    },
  };
}

const fail = (res: Response, e: any) => {
  console.error('ADS ERROR:', e?.message);
  res.status(500).json({ success: false, message: e?.message || 'Terjadi kesalahan.' });
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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    res.json({
      success: true,
      data: {
        store: storeMode(),
        cloudinary: !!(cloudName && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        rule: IMAGE_RULE,
        tema: TEMA,
      },
    });
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
      res.status(201).json({ success: true, data: await AdsService.create(p.data) });
    } catch (e) {
      fail(res, e);
    }
  },
  async adminUpdate(req: Request, res: Response) {
    try {
      const p = parseInput(req.body);
      if (!p.ok) return res.status(400).json({ success: false, message: p.message });
      const ad = await AdsService.update(String(req.params.id), p.data);
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
  // Tanda tangan upload Cloudinary: file dikirim browser langsung ke Cloudinary (tidak lewat Vercel).
  async cloudinarySign(_req: Request, res: Response) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !secret) {
      return res.status(503).json({ success: false, message: 'Cloudinary belum dikonfigurasi di server.' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'qiraat-ads';
    const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
    res.json({ success: true, data: { cloudName, apiKey, timestamp, folder, signature } });
  },
};
