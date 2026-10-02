import { Router } from 'express';
import { QuranController } from '../controllers/quran.controller';

const router = Router();

router.get('/surat', QuranController.getAllSurah);
router.get('/surat/:nomor', QuranController.getSurahDetail);
router.get('/surat-merged/:nomor', QuranController.getSurahDetailMerged);
router.get('/mushafs', QuranController.getMushafList);

// ROUTE
router.get('/reciters', QuranController.getReciters);

router.post('/shalat', QuranController.getJadwalShalat);
router.get('/doa', QuranController.getDaftarDoa);
router.get('/doa/:id', QuranController.getDetailDoa);

export default router;