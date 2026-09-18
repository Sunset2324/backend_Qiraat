import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// Memuat variabel dari file .env
dotenv.config();

// Setup Cache: Data Al-Qur'an di-cache selama 30 hari (dalam detik)
const quranCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 }); 
const shalatCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); // Cache shalat 1 hari

const BASE_URL = process.env.EQURAN_API_BASE_URL || 'https://equran.id/api/v2';

export const EquranService = {
  
  // ============================================
  // 0. MUSHAF LIST (Dari Quranpedia + Terjemahan)
  // ============================================
  async getMushafList() {
    const cacheKey = 'quranpedia_mushafs_translated_v2';
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/mushafs');
      
      let rawList = [];
      if (Array.isArray(data)) {
        rawList = data;
      } else if (data && typeof data === 'object') {
        rawList = data.data || data.mushafs || data.result || [];
      }

      // KAMUS TERJEMAHAN MUSHAF (ARAB → INDONESIA)
      const translateMushaf = (arabicName: string, arabicDesc: string) => {
        const name = arabicName || '';

        if (name.includes('مصحف حفص') && !name.includes('نسخة') && !name.includes('نستعليق')) {
          return { 
            name: "Mushaf Hafs (Standar Madinah)", 
            desc: "Mushaf Al-Qur'an dengan riwayat Hafs dari 'Asim. Ini adalah mushaf yang paling umum digunakan di Indonesia, Timur Tengah, dan mayoritas dunia Islam." 
          };
        }
        if (name.includes('حفص') && name.includes('نسخة') && !name.includes('نستعليق')) {
          return { 
            name: "Mushaf Hafs Versi Naskhi", 
            desc: "Mushaf Al-Qur'an riwayat Hafs dari 'Asim yang ditulis dengan kaligrafi Naskhi. Gaya tulisan ini jelas dan mudah dibaca." 
          };
        }
        if (name.includes('حفص') && name.includes('نستعليق')) {
          return { 
            name: "Mushaf Hafs Versi Nastaliq", 
            desc: "Mushaf Al-Qur'an riwayat Hafs dari 'Asim yang ditulis dengan kaligrafi Nastaliq. Umum digunakan di Pakistan, India, dan Asia Selatan." 
          };
        }
        if (name.includes('ورش')) {
          return { 
            name: "Mushaf Warsh (Warsh 'an Nafi')", 
            desc: "Mushaf Al-Qur'an dengan riwayat Warsh dari Imam Nafi'. Banyak digunakan di negara-negara Afrika Utara seperti Maroko, Aljazair, dan Tunisia." 
          };
        }
        if (name.includes('قالون')) {
          return { 
            name: "Mushaf Qalun (Qalun 'an Nafi')", 
            desc: "Mushaf Al-Qur'an dengan riwayat Qalun dari Imam Nafi'. Digunakan di Libya dan Tunisia. Saudara dari riwayat Warsh." 
          };
        }
        if (name.includes('الدوري') || name.includes('دوري')) {
          return { 
            name: "Mushaf Ad-Duri (Ad-Duri 'an Abu 'Amr)", 
            desc: "Mushaf Al-Qur'an dengan riwayat Ad-Duri dari Imam Abu 'Amr. Banyak digunakan di negara-negara Afrika seperti Sudan, Chad, dan Nigeria." 
          };
        }
        if (name.includes('السوسي') || name.includes('سوسي')) {
          return { 
            name: "Mushaf As-Susi (As-Susi 'an Abu 'Amr)", 
            desc: "Mushaf Al-Qur'an dengan riwayat As-Susi dari Imam Abu 'Amr. Digunakan di wilayah Somalia dan sebagian Yaman." 
          };
        }
        if (name.includes('شعبة') || name.includes('شعبه')) {
          return { 
            name: "Mushaf Syu'bah (Syu'bah 'an 'Asim)", 
            desc: "Mushaf Al-Qur'an dengan riwayat Syu'bah dari Imam 'Asim. Saudara dari riwayat Hafs, banyak dibaca di Yaman." 
          };
        }
        if (name.includes('خلف')) {
          return { 
            name: "Mushaf Khalaf (Khalaf 'an Hamzah)", 
            desc: "Mushaf Al-Qur'an dengan riwayat Khalaf dari Imam Hamzah. Salah satu dari 10 Qiraat Mutawatir." 
          };
        }
        if (name.includes('خلاد')) {
          return { 
            name: "Mushaf Khallad (Khallad 'an Hamzah)", 
            desc: "Mushaf Al-Qur'an dengan riwayat Khallad dari Imam Hamzah. Saudara dari riwayat Khalaf." 
          };
        }
        if (name.includes('ابن كثير')) {
          return { 
            name: "Mushaf Ibn Kathir", 
            desc: "Mushaf Al-Qur'an dengan riwayat Ibn Kathir dari Makkah. Salah satu dari 7 Qiraat Mutawatir." 
          };
        }
        if (name.includes('ابن عامر')) {
          return { 
            name: "Mushaf Ibn 'Amir", 
            desc: "Mushaf Al-Qur'an dengan riwayat Ibn 'Amir dari Syam (Suriah). Salah satu dari 7 Qiraat Mutawatir." 
          };
        }
        if (name.includes('ابو جعفر') || name.includes('أبو جعفر')) {
          return { 
            name: "Mushaf Abu Ja'far", 
            desc: "Mushaf Al-Qur'an dengan riwayat Abu Ja'far. Salah satu dari 3 Qiraat tambahan yang diakui." 
          };
        }
        if (name.includes('يعقوب')) {
          return { 
            name: "Mushaf Ya'qub", 
            desc: "Mushaf Al-Qur'an dengan riwayat Ya'qub al-Hadhrami. Salah satu dari 10 Qiraat Mutawatir." 
          };
        }
        if (name.includes('إسماعيل') || name.includes('اسماعيل')) {
          return { 
            name: "Mushaf Isma'il", 
            desc: "Mushaf Al-Qur'an dengan riwayat Isma'il ibn Ja'far. Salah satu dari Qiraat Mutawatir." 
          };
        }

        return { 
          name: name || 'Mushaf Tidak Dikenal', 
          desc: arabicDesc || "Mushaf Al-Qur'an dengan riwayat yang diakui dalam tradisi Islam." 
        };
      };

      const mappedData = rawList.map((item: any) => {
        const arabicName = item.name || item.nama || '';
        const arabicDesc = item.description || item.deskripsi || item.arabic_desc || '';
        const translation = translateMushaf(arabicName, arabicDesc);
        
        return {
          id: String(item.id || item.slug || item.kode || Math.random().toString(36)), 
          name: translation.name,
          arabic: arabicName,
          description: translation.desc
        };
      });

      quranCache.set(cacheKey, mappedData);
      return mappedData;
    } catch (error: any) {
      console.error('Gagal mengambil data mushaf:', error.message);
      throw new Error('Gagal memuat daftar mushaf');
    }
  },

  // ============================================
  // 1. DAFTAR SEMUA SURAH
  // ============================================
  async getAllSurah() {
    const cacheKey = 'all_surah';
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`${BASE_URL}/surat`);
    
    if (data.code === 200) {
      quranCache.set(cacheKey, data.data);
      return data.data;
    }
    throw new Error('Gagal mengambil daftar surah dari EQuran.id');
  },

  // ============================================
  // 2. DETAIL SURAH (Default Hafs dari EQuran.id)
  // ============================================
  async getSurahDetail(nomor: number, qariId: string = '05') {
    const cacheKey = `surah_${nomor}_qari_${qariId}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`${BASE_URL}/surat/${nomor}`);
    
    if (data.code === 200) {
      const raw = data.data;
      
      const processed = {
        info: {
          nomor: raw.nomor,
          nama: raw.nama,
          namaLatin: raw.namaLatin,
          arti: raw.arti,
          jumlahAyat: raw.jumlahAyat,
        },
        audioFull: raw.audioFull[qariId] || raw.audioFull['05'],
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
  },

  // ============================================
  // 3. DETAIL SURAH MERGED (Arab dari Quranpedia + Terjemahan dari EQuran)
  // ============================================
  async getSurahDetailMerged(nomor: number, mushafId: string, qariId: string = '05') {
    try {
      console.log(`[MERGED] Fetching surah ${nomor} | Mushaf: ${mushafId} | Qari: ${qariId}`);
      
      let arabicData = [];
      let mushafAktifName = 'HAFS (Fallback)';

      // 1. Coba ambil Teks Arab dari Quranpedia
      try {
        const quranpediaRes = await axios.get(`https://api.quranpedia.net/v1/quran/${mushafId}/${nomor}`);
        
        if (quranpediaRes.data && Array.isArray(quranpediaRes.data.data)) {
          arabicData = quranpediaRes.data.data;
          mushafAktifName = mushafId.toUpperCase();
        } else if (quranpediaRes.data && Array.isArray(quranpediaRes.data.ayat)) {
          arabicData = quranpediaRes.data.ayat;
          mushafAktifName = mushafId.toUpperCase();
        } else {
          console.warn('[MERGED] Format data Quranpedia tidak dikenali. Menggunakan fallback EQuran.id');
        }
      } catch (qpError: any) {
        console.warn(`[MERGED] Gagal ambil dari Quranpedia: ${qpError.message}. Menggunakan fallback EQuran.id`);
      }

      // 2. Ambil Terjemahan & Audio dari EQuran.id (Fallback utama yang pasti berhasil)
      const equranRes = await axios.get(`${BASE_URL}/surat/${nomor}`);
      if (equranRes.data.code !== 200) {
        throw new Error('Gagal mengambil data dasar dari EQuran.id');
      }

      const translationData = equranRes.data.data.ayat || [];
      const infoSurah = equranRes.data.data.info || {};

      // 3. Gabungkan dengan aman (graceful fallback)
      const mergedAyat = translationData.map((ayatTerjemahan: any, index: number) => {
        const ayatArab = arabicData[index] || {};
        
        return {
          nomor: ayatTerjemahan.nomor || (index + 1),
          teksArab: ayatArab.teksArab || ayatArab.text || ayatArab.arab || ayatTerjemahan.teksArab || '',
          teksLatin: ayatTerjemahan.teksLatin || '',
          teksIndonesia: ayatTerjemahan.teksIndonesia || ayatTerjemahan.arti || 'Terjemahan tidak tersedia',
          audio: ayatTerjemahan.audio ? (ayatTerjemahan.audio[qariId] || Object.values(ayatTerjemahan.audio)[0]) : ''
        };
      });

      return {
        info: {
          nomor: infoSurah.nomor || nomor,
          nama: infoSurah.nama,
          namaLatin: infoSurah.namaLatin,
          arti: infoSurah.arti,
          jumlahAyat: infoSurah.jumlahAyat || mergedAyat.length,
          tempatTurun: infoSurah.tempatTurun,
          mushafAktif: mushafAktifName
        },
        ayat: mergedAyat
      };
    } catch (error: any) {
      console.error('🔥 CRITICAL ERROR in getSurahDetailMerged:', error.message);
      throw new Error('Gagal memuat detail surah');
    }
  },

  // ============================================
  // 4. JADWAL SHALAT
  // ============================================
  async getJadwalShalat(provinsi: string, kabkota: string, bulan: number, tahun: number = 2026) {
    const cacheKey = `shalat_${provinsi}_${kabkota}_${bulan}_${tahun}`;
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

  // ============================================
  // 5. DAFTAR DOA & DZIKIR
  // ============================================
  async getDaftarDoa(grup?: string, tag?: string) {
    const cacheKey = `doa_list_${grup || 'all'}_${tag || 'all'}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const url = new URL('https://equran.id/api/doa');
    if (grup) url.searchParams.append('grup', grup);
    if (tag) url.searchParams.append('tag', tag);

    const { data } = await axios.get(url.toString());
    
    if (data.status === 'success') {
      const mappedData = data.data.map((item: any) => ({
        id: item.id,
        judul: item.nama,
        doa: item.ar,
        latin: item.tr,
        arti: item.idn,
        grup: item.grup,
        tags: item.tag
      }));
      
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Gagal mengambil daftar doa');
  },

  // ============================================
  // 6. DETAIL DOA
  // ============================================
  async getDetailDoa(id: number) {
    const cacheKey = `doa_detail_${id}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`https://equran.id/api/doa/${id}`);
    
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
        tentang: item.tentang
      };
      
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Doa tidak ditemukan');
  }
};