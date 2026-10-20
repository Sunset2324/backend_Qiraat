import { Router, Request, Response, NextFunction } from 'express';
import { SiteService } from '../services/site.service';
import { adminAuth } from '../middleware/adminAuth';

// Pembatas laju sederhana per IP (cukup untuk form publik; di serverless bersifat "sebisanya").
const hits = new Map<string, number[]>();
const limit = (max: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
  const ip = String(req.headers['x-forwarded-for'] ?? req.ip ?? 'x').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip + req.path) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return res.status(429).json({ success: false, message: 'Terlalu banyak permintaan, coba lagi nanti.' });
  arr.push(now);
  hits.set(ip + req.path, arr);
  if (hits.size > 5000) hits.clear();
  next();
};

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const siteRouter = Router();

siteRouter.post('/site/feedback', limit(5, 10 * 60 * 1000), async (req, res) => {
  const name = clean(req.body?.name, 80);
  const email = clean(req.body?.email, 120);
  const message = clean(req.body?.message, 2000);
  if (req.body?.website) return res.json({ success: true }); // honeypot: bot mengisi kolom tersembunyi
  if (!name || !EMAIL.test(email) || message.length < 5) {
    return res.status(400).json({ success: false, message: 'Nama, email yang valid, dan pesan wajib diisi.' });
  }
  try {
    await SiteService.addFeedback({ name, email, message });
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('feedback error', e);
    res.status(500).json({ success: false, message: 'Gagal menyimpan pesan.' });
  }
});

siteRouter.post('/site/download', limit(30, 60 * 1000), async (req, res) => {
  try {
    await SiteService.addDownload({
      deviceType: clean(req.body?.deviceType, 20) || 'Unknown',
      userAgent: clean(req.headers['user-agent'], 300),
      version: clean(req.body?.version, 20) || 'unknown',
    });
    res.status(201).json({ success: true });
  } catch (e) {
    console.error('download log error', e);
    res.status(500).json({ success: false });
  }
});

// Baca data (admin)
export const siteAdminRouter = Router();
siteAdminRouter.use(adminAuth);
siteAdminRouter.get('/site/feedback', async (_q, r) => r.json({ success: true, data: await SiteService.listFeedback() }));
siteAdminRouter.get('/site/downloads', async (_q, r) =>
  r.json({ success: true, total: await SiteService.downloadCount(), data: await SiteService.listDownloads() })
);
