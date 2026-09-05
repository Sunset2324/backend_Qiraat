import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// Memuat variabel dari file .env
dotenv.config();

// Setup Cache: Data Al-Qur'an di-cache selama 30 hari (dalam detik)
// Karena data Al-Qur'an tidak pernah berubah, ini membuat API Anda super cepat
const quranCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 }); 

const BASE_URL = process.env.EQURAN_API_BASE_URL || 'https://equran.id/api/v2';

export const EquranService = {
  
  // 1. Mengambil Daftar Semua Surah
  async getAllSurah() {
    const cacheKey = 'all_surah';
    
    // Cek apakah data sudah ada di cache
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    // Jika belum, ambil dari API eksternal
    const { data } = await axios.get(`${BASE_URL}/surat`);
    
    if (data.code === 200) {
      quranCache.set(cacheKey, data.data); // Simpan ke cache
      return data.data;
    }
    throw new Error('Gagal mengambil daftar surah dari EQuran.id');
  },

  // 2. Mengambil Detail Surah, Ayat, dan Audio
  async getSurahDetail(nomor: number, qariId: string = '05') {
    const cacheKey = `surah_${nomor}_qari_${qariId}`;
    
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`${BASE_URL}/surat/${nomor}`);
    
    if (data.code === 200) {
      const raw = data.data;
      
      // Mengolah data agar lebih ringan untuk dikirim ke React Native
      const processed = {
        info: {
          nomor: raw.nomor,
          nama: raw.nama,
          namaLatin: raw.namaLatin,
          arti: raw.arti,
          jumlahAyat: raw.jumlahAyat,
        },
      // 3. Mengambil Jadwal Shalat Bulanan
  async getJadwalShalat(provinsi: string, kabkota: string, bulan: number, tahun: number = 2026) {
    const cacheKey = `shalat_${provinsi}_${kabkota}_${bulan}_${tahun}`;
    
    // Cache lebih pendek (1 hari) karena jadwal shalat bisa berubah/update
    const shalatCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); 
    const cached = shalatCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.post(`${BASE_URL}/shalat`, {
      provinsi,
      kabkota,
      bulan,
      tahun
    });

    if (data.code === 200) {
      shalatCache.set(cacheKey, data.data);
      return data.data;
    }
    throw new Error('Gagal mengambil jadwal shalat');
  },
    // 4. Mengambil Daftar Doa & Dzikir (dengan filter opsional)
   // 4. Mengambil Daftar Doa & Dzikir (dengan filter opsional)
  async getDaftarDoa(grup?: string, tag?: string) {
    const cacheKey = `doa_list_${grup || 'all'}_${tag || 'all'}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const url = new URL('https://equran.id/api/doa');
    if (grup) url.searchParams.append('grup', grup);
    if (tag) url.searchParams.append('tag', tag);

    const { data } = await axios.get(url.toString());
    
    // ✅ PERBAIKAN: API Doa menggunakan "status": "success", bukan "code": 200
    if (data.status === 'success') {
      // Mapping data agar konsisten dengan format yang diharapkan frontend
      const mappedData = data.data.map((item: any) => ({
        id: item.id,
        judul: item.nama,       // 'nama' di API -> 'judul' di frontend
        doa: item.ar,           // 'ar' di API -> 'doa' di frontend
        latin: item.tr,         // 'tr' di API -> 'latin' di frontend
        arti: item.idn,         // 'idn' di API -> 'arti' di frontend
        grup: item.grup,
        tags: item.tag
      }));
      
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Gagal mengambil daftar doa');
  },

  // 5. Mengambil Detail Doa Spesifik berdasarkan ID
  async getDetailDoa(id: number) {
    const cacheKey = `doa_detail_${id}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`https://equran.id/api/doa/${id}`);
    
    // ✅ PERBAIKAN: Cek "status": "success"
    if (data.status === 'success') {
      const item = data.data;
      const mappedData = {
        id: item.id,
        judul: item.nama,
        doa: item.ar,
        latin: item.tr,
        arti: item.idn,
        grup: item.grup,
        tags: item.tag,
        tentang: item.tentang // Tambahan info sumber/tentang
      };
      
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Doa tidak ditemukan');
  },

        audioFull: raw.audioFull[qariId] || raw.audioFull['05'], // Fallback ke Qari default jika ID salah
        ayat: raw.ayat.map((a: any) => ({
          nomor: a.nomorAyat,
          teksArab: a.teksArab,
          teksLatin: a.teksLatin,
          teksIndonesia: a.teksIndonesia,
          audio: a.audio[qariId] || a.audio['05']
        }))
      };

      quranCache.set(cacheKey, processed);
      return processed;
    }
    throw new Error('Surah tidak ditemukan');
  }
};