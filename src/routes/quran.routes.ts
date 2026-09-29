import { Router } from 'express';
import { QuranController } from '../controllers/quran.controller';

const router = Router();

// ============================================
// ROUTE RECITER / QARI (BARU)
// ============================================
router.get('/reciters', QuranController.getReciters);

// ============================================
// ROUTE SURAH
// ============================================
router.get('/surat', QuranController.getAllSurah);
router.get('/surat/:nomor', QuranController.getSurahDetail);

// ============================================
// ROUTE SURAH MERGED (Arab Quranpedia + Terjemahan EQuran + Audio Quranpedia)
// ============================================
router.get('/surat-merged/:nomor', QuranController.getSurahDetailMerged);

// ============================================
// ROUTE MUSHAF/QIRAAT
// ============================================
router.get('/mushafs', QuranController.getMushafList);

// ============================================
// ROUTE JADWAL SHALAT
// ============================================
router.post('/shalat', QuranController.getJadwalShalat);

// ============================================
// ROUTE DOA & DZIKIR
// ============================================
router.get('/doa', QuranController.getDaftarDoa);
router.get('/doa/:id', QuranController.getDetailDoa);

export default router;