import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quranRoutes from './routes/quran.routes';
import { publicAdsRouter, adminRouter } from './routes/ads.routes';
import { siteRouter, siteAdminRouter } from './routes/site.routes';
import { notifArtPng } from './assets/notifArt';
import { securityHeaders, corsOptions, rateLimit, adminLoginGuard, warnWeakAdminKey } from './middleware/security';

dotenv.config();

const app = express();

// Middleware
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors(corsOptions));
warnWeakAdminKey();
// Batas permintaan per IP: form publik dan admin. API baca untuk app sengaja TIDAK dibatasi per IP
// (banyak pengguna seluler berbagi satu IP lewat CGNAT, pembatas per IP akan memblokir pengguna sah).
app.use('/api/site/feedback', rateLimit('feedback', 5, 10 * 60 * 1000));
app.use('/api/site/download', rateLimit('download', 30, 60 * 1000));
app.use('/admin/api', rateLimit('admin', 120, 60 * 1000), adminLoginGuard);
// Admin boleh mengirim gambar (data URL ~500KB); rute lain tetap dibatasi kecil.
app.use('/admin', express.json({ limit: '1mb' }));
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', quranRoutes);
app.use('/api', publicAdsRouter);
app.use('/api', siteRouter);
app.get('/api/notif-art.png', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('png').send(notifArtPng);
});
app.use('/admin/api', siteAdminRouter);
app.use('/admin', adminRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Backend Qiraat-Al-Qur-an is running.' });
});

// Hosting biasa (VPS/Docker/Hostinger/dll) menjalankan server sendiri.
// Di Vercel (serverless) tidak boleh listen; cukup ekspor app.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT as number, () => console.log(`Backend Qiraat berjalan di port ${PORT}`));
}

// Jangan bocorkan detail kesalahan internal ke klien
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Permintaan terlalu besar.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Format permintaan tidak valid.' });
  console.error('UNHANDLED:', err?.message);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan.' });
});

export default app;
