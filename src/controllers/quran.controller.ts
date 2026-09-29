import { Request, Response } from 'express';
import { EquranService } from '../services/equran.service';

export const QuranController = {
  
  // 0. Daftar Reciter / Qari (Dari Quranpedia)
  async getReciters(req: Request, res: Response) {
    try {
      const data = await EquranService.getReciters();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getReciters:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 1. Daftar Semua Surah
  async getAllSurah(req: Request, res: Response) {
    try {
      const data = await EquranService.getAllSurah();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getAllSurah:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 2. Detail Surah (Default Hafs, Audio dari Quranpedia)
  async getSurahDetail(req: Request, res: Response) {
    try {
      const nomor = parseInt(String(req.params.nomor), 10);
      const reciterId = (req.query.reciterId as string) || '114'; // Default Mishary
      
      const data = await EquranService.getSurahDetail(nomor, reciterId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getSurahDetail:", error.message);
      res.status(404).json({ success: false, message: error.message });
    }
  },

  // 3. Detail Surah Merged (Arab Quranpedia + Terjemahan EQuran + Audio Quranpedia)
  async getSurahDetailMerged(req: Request, res: Response) {
    try {
      const nomor = parseInt(String(req.params.nomor), 10);
      const mushafId = (req.query.mushafId as string) || '1'; // ID Quranpedia (1 = Hafs)
      const reciterId = (req.query.reciterId as string) || '114'; // Default Mishary

      if (isNaN(nomor) || nomor < 1 || nomor > 114) {
        return res.status(400).json({ success: false, message: 'Nomor surah harus 1-114' });
      }
      
      console.log(`📥 Request masuk: /surat-merged/${nomor}?mushafId=${mushafId}&reciterId=${reciterId}`);
      
      const data = await EquranService.getSurahDetailMerged(nomor, mushafId, reciterId);
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