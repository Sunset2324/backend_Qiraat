import { Router } from 'express';
import { AdsController } from '../controllers/ads.controller';
import { adminAuth } from '../middleware/adminAuth';
import { adminPageHtml } from '../admin/adminPage';

export const publicAdsRouter = Router();
publicAdsRouter.get('/ads', AdsController.publicList);

export const adminRouter = Router();
// Halaman form (HTML saja, tanpa data); semua data lewat API yang butuh x-admin-key.
adminRouter.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(adminPageHtml);
});
adminRouter.use('/api', adminAuth);
adminRouter.get('/api/config', AdsController.adminConfig);
adminRouter.get('/api/ads', AdsController.adminList);
adminRouter.post('/api/ads', AdsController.adminCreate);
adminRouter.put('/api/ads/:id', AdsController.adminUpdate);
adminRouter.delete('/api/ads/:id', AdsController.adminDelete);
adminRouter.post('/api/cloudinary-sign', AdsController.cloudinarySign);
