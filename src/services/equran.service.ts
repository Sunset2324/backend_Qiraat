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