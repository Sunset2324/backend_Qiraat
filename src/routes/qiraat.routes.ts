import { Router } from 'express';
import { QiraatController } from '../controllers/qiraat.controller';

const router = Router();

router.get('/', QiraatController.standard); // data standar imam/rawi/tariq
router.get('/sumber', QiraatController.sources); // ketersediaan teks/audio/variant per riwayah
router.get('/timing', QiraatController.timing); // timing per ayat (mp3quran)
router.get('/variant/:surah', QiraatController.variants); // variant per kata (Quran Foundation)
router.get('/:riwayahId/qari', QiraatController.reciters); // qari satu riwayah dari semua sumber

export default router;
