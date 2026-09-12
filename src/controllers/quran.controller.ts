import { Request, Response } from 'express';
import { EquranService } from '../services/equran.service';

export const QuranController = {
  async getAllSurah(req: Request, res: Response) {
    try {
      const data = await EquranService.getAllSurah();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getSurahDetail(req: Request, res: Response) {
    try {
      const nomor = parseInt(String(req.params.nomor), 10);
      const qari = (req.query.qari as string) || '05';
      
      const data = await EquranService.getSurahDetail(nomor, qari);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

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
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDaftarDoa(req: Request, res: Response) {
    try {
      const { grup, tag } = req.query;
      const data = await EquranService.getDaftarDoa(grup as string, tag as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDetailDoa(req: Request, res: Response) {
    try {
      // ✅ DIPERBAIKI: Menghapus sisa kode 'grup' yang tidak relevan di sini
      const id = parseInt(String(req.params.id), 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID doa harus berupa angka' });
      }

      const data = await EquranService.getDetailDoa(id);
      res.json({ success: true, data });
    } catch (error: any) {
      // ✅ DIPERBAIKI: Nama log error disesuaikan
      console.error("🔥 BACKEND ERROR getDetailDoa:", error.message); 
      res.status(404).json({ success: false, message: error.message });
    }
  },

  async getMushafList(req: Request, res: Response) {
    try {
      const data = await EquranService.getMushafList();
      res.json({ success: true, data });
    } catch (error: any) {
      // ✅ DITAMBAHKAN: Log error untuk memudahkan debugging jika 404/500 masih muncul
      console.error("🔥 BACKEND ERROR getMushafList:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};