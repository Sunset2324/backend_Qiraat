import { Request, Response } from 'express';
import { EquranService } from '../services/equran.service';
import { ReciterService } from '../services/Reciter.service';
import { PageService } from '../services/page.service';

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
      const mushafId = (req.query.mushafId as string) || '1'; // ID Quranpedia (1 = Hafs)
      const qariId = (req.query.qariId as string) || '05';
      const reciterParsed = parseInt(String(req.query.reciterId ?? ''), 10);
      const reciterId = Number.isFinite(reciterParsed) ? reciterParsed : undefined;

      if (isNaN(nomor) || nomor < 1 || nomor > 114) {
        return res.status(400).json({ success: false, message: 'Nomor surah harus 1-114' });
      }
      
      console.log(`📥 Request masuk: /surat-merged/${nomor}?mushafId=${mushafId}&qariId=${qariId}&reciterId=${reciterId ?? '-'}`);
      
      const data = await EquranService.getSurahDetailMerged(nomor, mushafId, qariId, reciterId);
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

  // 4b. Daftar provinsi untuk jadwal shalat
  async getProvinsiShalat(_req: Request, res: Response) {
    try {
      const data = await EquranService.getProvinsiShalat();
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getProvinsiShalat:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 4c. Daftar kab/kota dalam satu provinsi
  async getKabKotaShalat(req: Request, res: Response) {
    try {
      const { provinsi } = req.body;
      if (!provinsi) {
        return res.status(400).json({ success: false, message: 'Provinsi wajib diisi' });
      }
      const data = await EquranService.getKabKotaShalat(String(provinsi));
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getKabKotaShalat:", error.message);
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
  },

  // 8. Daftar Qari lengkap (Quranpedia).
  // Opsional: ?rawi=حفص (filter rawi) dan ?surah=2 (hanya qari yang punya surah itu)
  async getReciters(req: Request, res: Response) {
    try {
      let rawi = req.query.rawi ? String(req.query.rawi) : undefined;
      // ?mushafId=4 -> otomatis hanya qari yang membaca riwayat mushaf tersebut
      if (!rawi && req.query.mushafId) {
        rawi = (await EquranService.getMushafRawi(String(req.query.mushafId))) ?? undefined;
      }
      const surahParam = req.query.surah ? parseInt(String(req.query.surah), 10) : NaN;
      const surah = Number.isInteger(surahParam) && surahParam >= 1 && surahParam <= 114 ? surahParam : undefined;
      const data = await ReciterService.getPublicList(rawi, surah);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getReciters:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // 9. Ringkasan halaman sebuah mushaf (qiraat): jumlah halaman + juz + surah pertama tiap halaman
  async getPagesSummary(req: Request, res: Response) {
    try {
      const mushafId = String(req.params.id);
      if (!/^\d+$/.test(mushafId)) return res.status(400).json({ success: false, message: 'mushafId tidak valid' });
      const data = await PageService.getSummary(mushafId);
      res.set('Cache-Control', 'public, max-age=86400');
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getPagesSummary:", error.message);
      res.status(500).json({ success: false, message: 'Gagal memuat daftar halaman' });
    }
  },

  // 10. Isi satu halaman mushaf (ayat dikelompokkan per surah)
  async getPage(req: Request, res: Response) {
    try {
      const mushafId = String(req.params.id);
      const page = parseInt(String(req.params.page), 10);
      if (!/^\d+$/.test(mushafId) || !Number.isInteger(page) || page < 1) {
        return res.status(400).json({ success: false, message: 'Mushaf atau nomor halaman tidak valid' });
      }
      const data = await PageService.getPage(mushafId, page);
      res.set('Cache-Control', 'public, max-age=86400');
      res.json({ success: true, data });
    } catch (error: any) {
      const notFound = /tidak ditemukan/.test(error.message);
      console.error("🔥 BACKEND ERROR getPage:", error.message);
      res.status(notFound ? 404 : 500).json({ success: false, message: notFound ? error.message : 'Gagal memuat halaman' });
    }
  },
};
