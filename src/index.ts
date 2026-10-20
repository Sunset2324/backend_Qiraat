import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quranRoutes from './routes/quran.routes';
import { publicAdsRouter, adminRouter } from './routes/ads.routes';
import { siteRouter, siteAdminRouter } from './routes/site.routes';
import { notifArtPng } from './assets/notifArt';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
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

export default app;
