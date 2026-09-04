import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quranRoutes from './routes/quran.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', quranRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ message: '🚀 Backend Qiraat-Al-Qur-an is running!' });
});

app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
});