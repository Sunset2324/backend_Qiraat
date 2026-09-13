import { Router } from 'express';
import { QuranController } from '../controllers/quran.controller';

const router = Router();

// Route untuk Surah
router.get('/surat', QuranController.getAllSurah);
router.get('/surat/:nomor', QuranController.getSurahDetail);

// Route untuk Jadwal Shalat
router.post('/shalat', QuranController.getJadwalShalat);

// Route untuk Doa & Dzikir
router.get('/doa', QuranController.getDaftarDoa);
router.get('/doa/:id', QuranController.getDetailDoa);

// ✅ PASTIKAN BARIS INI ADA DI SINI (Paling Penting!)
router.get('/mushafs', QuranController.getMushafList);

export default router;