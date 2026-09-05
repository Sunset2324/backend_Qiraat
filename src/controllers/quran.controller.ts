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
      
      // Validasi input sederhana
      if (!provinsi || !kabkota || !bulan) {
        return res.status(400).json({ 
          success: false, 
          message: 'Provinsi, Kab/Kota, dan Bulan wajib diisi' 
        });
      }

      const data = await (EquranService as typeof EquranService & {
        getJadwalShalat(provinsi: string, kabkota: string, bulan: string, tahun?: string): Promise<any>;
      }).getJadwalShalat(provinsi, kabkota, bulan, tahun);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
    async getDaftarDoa(req: Request, res: Response) {
    try {
      // Ambil query parameter ?grup=... atau ?tag=... dari URL
      const { grup, tag } = req.query;
      const data = await (EquranService as typeof EquranService & {
        getDaftarDoa(grup?: string, tag?: string): Promise<any>;
      }).getDaftarDoa(grup as string, tag as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getDetailDoa(req: Request, res: Response) {
    try {
      const grupParam = req.query.grup;
const grup = Array.isArray(grupParam) ? grupParam[0] : grupParam;
    const id = parseInt(String(req.params.id), 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'ID doa harus berupa angka' });
      }

      const data = await (EquranService as typeof EquranService & {
        getDetailDoa(id: number): Promise<any>;
      }).getDetailDoa(id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getDaftarDoa:", error.message); 
      res.status(404).json({ success: false, message: error.message });
    }
  },
  
};