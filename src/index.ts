import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quranRoutes from './routes/quran.routes';
import { publicAdsRouter, adminRouter } from './routes/ads.routes';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

// Routes
app.use('/api', quranRoutes);
app.use('/api', publicAdsRouter);
app.use('/admin', adminRouter);

app.get('/', (req, res) => {
  res.json({ message: '🚀 Backend Qiraat-Al-Qur-an is running on Vercel!' });
});

// HAPUS BAGIAN INI:
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => { ... });

// TAMBAHKAN INI DI PALING BAWAH:
export default app;