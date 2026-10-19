import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quranRoutes from './routes/quran.routes';
import { publicAdsRouter, adminRouter } from './routes/ads.routes';
import { siteRouter, siteAdminRouter } from './routes/site.routes';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', quranRoutes);
app.use('/api', publicAdsRouter);
app.use('/api', siteRouter);
app.use('/admin/api', siteAdminRouter);
app.use('/admin', adminRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Backend Qiraat-Al-Qur-an is running.' });
});

// Hosting biasa (VPS/Docker/Hostinger/dll) menjalankan server sendiri.
// Di Vercel (serverless) tidak boleh listen; cukup ekspor app.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`Backend Qiraat berjalan di port ${PORT}`));
}

export default app;