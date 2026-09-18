import { Request, Response } from 'express';
import { EquranService } from '../services/equran.service';

export const QuranController = {
  
  // 1. Daftar Semua Surah
  async getAllSurah(req: Request, res: Response) {
    try {
      const data = await EquranService.getAllSurah();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error(" BACKEND ERROR getAllSurah:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 2. Detail Surah (Default Hafs)
  async getSurahDetail(req: Request, res: Response) {
    try {
      const nomor = parseInt(String(req.params.nomor), 10);
      const qari = (req.query.qari as string) || '05';
      
      const data = await EquranService.getSurahDetail(nomor, qari);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getSurahDetail:", error.message);
      res.status(404).json({ success: false, message: error.message });
    }
  },

  // 3. Detail Surah Merged (Arab Quranpedia + Terjemahan EQuran)
    async getSurahDetailMerged(req: Request, res: Response) {
    try {
      const nomor = parseInt(String(req.params.nomor), 10);
      const mushafId = (req.query.mushafId as string) || 'hafs';
      const qariId = (req.query.qariId as string) || '05';
      
      console.log(`📥 Request masuk: /surat-merged/${nomor}?mushafId=${mushafId}&qariId=${qariId}`);
      
      const data = await EquranService.getSurahDetailMerged(nomor, mushafId, qariId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getSurahDetailMerged:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 4. Jadwal Shalat
  async getJadwalShalat(req: Request, res: Response) {
    try {
      const { provinsi, kabkota, bulan, tahun } = req.body;
      
      if (!provinsi || !kabkota || !bulan) {
        return res.status(400).json({ 
          success: false, 
          message: 'Provinsi, Kab/Kota, dan Bulan wajib diisi' 
        });
      }

      const data = await EquranService.getJadwalShalat(
        provinsi, 
        kabkota, 
        parseInt(String(bulan), 10), 
        tahun ? parseInt(String(tahun), 10) : new Date().getFullYear()
      );
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getJadwalShalat:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 5. Daftar Doa
  async getDaftarDoa(req: Request, res: Response) {
    try {
      const { grup, tag } = req.query;
      const data = await EquranService.getDaftarDoa(grup as string, tag as string);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getDaftarDoa:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 6. Detail Doa
  async getDetailDoa(req: Request, res: Response) {
    try {
      const id = parseInt(String(req.params.id), 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID doa harus berupa angka' });
      }

      const data = await EquranService.getDetailDoa(id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getDetailDoa:", error.message);
      res.status(404).json({ success: false, message: error.message });
    }
  },

  // 7. Daftar Mushaf/Qiraat (Dari Quranpedia + Terjemahan)
  async getMushafList(req: Request, res: Response) {
    try {
      const data = await EquranService.getMushafList();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getMushafList:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};