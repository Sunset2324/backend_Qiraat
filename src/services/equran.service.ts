import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// Memuat variabel dari file .env
dotenv.config();

// Setup Cache: Data Al-Qur'an di-cache selama 30 hari (dalam detik)
const quranCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 }); 
const shalatCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); // Cache shalat 1 hari

const BASE_URL = process.env.EQURAN_API_BASE_URL || 'https://equran.id/api/v2';

interface ArabicAyah {
  number: number;
  text: string;
  hafsNumbers: number[];
}
interface ArabicResult {
  source: 'quranpedia' | 'alquran.cloud';
  ayahs: ArabicAyah[];
}

export const EquranService = {
  
  // ============================================
  // 0a. DAFTAR QARI / RECITER (Dari Quranpedia)
  // ============================================
  async getReciters() {
    const cacheKey = 'quranpedia_reciters_v1';
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/reciters');
      
      const mappedReciters = (Array.isArray(data) ? data : []).map((r: any) => {
        // Cek apakah klasifikasi mengandung "آيات" (per ayat)
        const isPerAyah = r.classification && r.classification.includes('آيات');
        return {
          id: String(r.id),
          name: r.name,
          nameLatin: r.name_latin || r.name,
          server: r.server,
          classification: r.classification,
          isPerAyah: isPerAyah,
        };
      });

      // Urutkan: prioritaskan yang "per ayat" di paling atas agar mudah dipilih untuk "Ikuti Bacaan"
      mappedReciters.sort((a: any, b: any) => (b.isPerAyah ? 1 : 0) - (a.isPerAyah ? 1 : 0));

      quranCache.set(cacheKey, mappedReciters);
      return mappedReciters;
    } catch (error: any) {
      console.error('Gagal mengambil data reciter:', error.message);
      throw new Error('Gagal memuat daftar qari');
    }
  },

  // ============================================
  // 0b. MUSHAF LIST (Dari Quranpedia + Terjemahan)
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
          return { name: "Mushaf Hafs (Standar Madinah)", desc: "Mushaf Al-Qur'an dengan riwayat Hafs dari 'Asim. Ini adalah mushaf yang paling umum digunakan di Indonesia, Timur Tengah, dan mayoritas dunia Islam." };
        }
        if (name.includes('حفص') && name.includes('نسخة') && !name.includes('نستعليق')) {
          return { name: "Mushaf Hafs Versi Naskhi", desc: "Mushaf Al-Qur'an riwayat Hafs dari 'Asim yang ditulis dengan kaligrafi Naskhi. Gaya tulisan ini jelas dan mudah dibaca." };
        }
        if (name.includes('حفص') && name.includes('نستعليق')) {
          return { name: "Mushaf Hafs Versi Nastaliq", desc: "Mushaf Al-Qur'an riwayat Hafs dari 'Asim yang ditulis dengan kaligrafi Nastaliq. Umum digunakan di Pakistan, India, dan Asia Selatan." };
        }
        if (name.includes('ورش')) {
          return { name: "Mushaf Warsh (Warsh 'an Nafi')", desc: "Mushaf Al-Qur'an dengan riwayat Warsh dari Imam Nafi'. Banyak digunakan di negara-negara Afrika Utara seperti Maroko, Aljazair, dan Tunisia." };
        }
        if (name.includes('قالون')) {
          return { name: "Mushaf Qalun (Qalun 'an Nafi')", desc: "Mushaf Al-Qur'an dengan riwayat Qalun dari Imam Nafi'. Digunakan di Libya dan Tunisia. Saudara dari riwayat Warsh." };
        }
        if (name.includes('الدوري') || name.includes('دوري')) {
          return { name: "Mushaf Ad-Duri (Ad-Duri 'an Abu 'Amr)", desc: "Mushaf Al-Qur'an dengan riwayat Ad-Duri dari Imam Abu 'Amr. Banyak digunakan di negara-negara Afrika seperti Sudan, Chad, dan Nigeria." };
        }
        if (name.includes('السوسي') || name.includes('سوسي')) {
          return { name: "Mushaf As-Susi (As-Susi 'an Abu 'Amr)", desc: "Mushaf Al-Qur'an dengan riwayat As-Susi dari Imam Abu 'Amr. Digunakan di wilayah Somalia dan sebagian Yaman." };
        }
        if (name.includes('شعبة') || name.includes('شعبه')) {
          return { name: "Mushaf Syu'bah (Syu'bah 'an 'Asim)", desc: "Mushaf Al-Qur'an dengan riwayat Syu'bah dari Imam 'Asim. Saudara dari riwayat Hafs, banyak dibaca di Yaman." };
        }
        if (name.includes('خلف')) {
          return { name: "Mushaf Khalaf (Khalaf 'an Hamzah)", desc: "Mushaf Al-Qur'an dengan riwayat Khalaf dari Imam Hamzah. Salah satu dari 10 Qiraat Mutawatir." };
        }
        if (name.includes('خلاد')) {
          return { name: "Mushaf Khallad (Khallad 'an Hamzah)", desc: "Mushaf Al-Qur'an dengan riwayat Khallad dari Imam Hamzah. Saudara dari riwayat Khalaf." };
        }
        if (name.includes('ابن كثير')) {
          return { name: "Mushaf Ibn Kathir", desc: "Mushaf Al-Qur'an dengan riwayat Ibn Kathir dari Makkah. Salah satu dari 7 Qiraat Mutawatir." };
        }
        if (name.includes('ابن عامر')) {
          return { name: "Mushaf Ibn 'Amir", desc: "Mushaf Al-Qur'an dengan riwayat Ibn 'Amir dari Syam (Suriah). Salah satu dari 7 Qiraat Mutawatir." };
        }
        if (name.includes('ابو جعفر') || name.includes('أبو جعفر')) {
          return { name: "Mushaf Abu Ja'far", desc: "Mushaf Al-Qur'an dengan riwayat Abu Ja'far. Salah satu dari 3 Qiraat tambahan yang diakui." };
        }
        if (name.includes('يعقوب')) {
          return { name: "Mushaf Ya'qub", desc: "Mushaf Al-Qur'an dengan riwayat Ya'qub al-Hadhrami. Salah satu dari 10 Qiraat Mutawatir." };
        }
        if (name.includes('إسماعيل') || name.includes('اسماعيل')) {
          return { name: "Mushaf Isma'il", desc: "Mushaf Al-Qur'an dengan riwayat Isma'il ibn Ja'far. Salah satu dari Qiraat Mutawatir." };
        }
        if (name.includes('البزي') || name.includes('بزي')) {
          return { name: "Mushaf Al-Bazzi (Al-Bazzi 'an Ibn Kathir)", desc: "Mushaf Al-Qur'an dengan riwayat Al-Bazzi dari Imam Ibn Kathir. Salah satu dari 2 riwayat utama dari Ibn Kathir (Makkah)." };
        }
        if (name.includes('قنبل')) {
          return { name: "Mushaf Qunbul (Qunbul 'an Ibn Kathir)", desc: "Mushaf Al-Qur'an dengan riwayat Qunbul dari Imam Ibn Kathir. Saudara dari riwayat Al-Bazzi, sama-sama dari Ibn Kathir." };
        }
        if (name.includes('التجويد') || name.includes('تجويد')) {
          return { name: "Mushaf Tajwid Berwarna", desc: "Mushaf Al-Qur'an dengan kode warna khusus pada huruf untuk memudahkan mempelajari hukum bacaan Tajwid. Sangat cocok untuk pemula." };
        }
        if (name.includes('الأوقاف') || name.includes('اوقاف')) {
          return { name: "Mushaf Qalun (Versi Libya - Al-Awqaf)", desc: "Mushaf Al-Qur'an dengan riwayat Qalun dari Imam Nafi', versi khusus dari Libyan General Authority of Awqaf. Digunakan di Libya." };
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
  // 2. DETAIL SURAH (Default Hafs, Audio dari Quranpedia)
  // ============================================
  async getSurahDetail(nomor: number, reciterId: string = '114') {
    const cacheKey = `surah_${nomor}_reciter_${reciterId}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get(`${BASE_URL}/surat/${nomor}`);
      if (data.code !== 200) throw new Error('Surah tidak ditemukan');
      
      const raw = data.data;
      
      // Ambil info reciter untuk URL audio
      const reciters = await EquranService.getReciters();
      const reciter = reciters.find((r: any) => r.id === String(reciterId)) || reciters[0];

      // Bangun URL audio dinamis
      const audioFullUrl = reciter ? `${reciter.server}/1/${nomor}.mp3` : '';

      const processed = {
        info: {
          nomor: raw.nomor,
          nama: raw.nama,
          namaLatin: raw.namaLatin,
          arti: raw.arti,
          jumlahAyat: raw.jumlahAyat,
          reciterAktif: reciter ? (reciter.nameLatin || reciter.name) : 'Unknown',
        },
        audioFull: audioFullUrl,
        ayat: raw.ayat.map((a: any) => {
          const audioUrl = reciter ? `${reciter.server}/1/${nomor}/${a.nomorAyat}.mp3` : '';
          return {
            nomor: a.nomorAyat,
            teksArab: a.teksArab,
            teksLatin: a.teksLatin,
            teksIndonesia: a.teksIndonesia,
            audio: audioUrl
          };
        })
      };
      quranCache.set(cacheKey, processed);
      return processed;
    } catch (error: any) {
      console.error("🔥 BACKEND ERROR getSurahDetail:", error.message);
      throw new Error('Gagal memuat detail surah');
    }
  },

  // ============================================
  // 3a. TEKS ARAB (helper untuk merged)
  // Prioritas : Quranpedia sesuai mushafId  →  fallback AlQuran.cloud (Hafs)
  // Endpoint Quranpedia yang benar: GET /v1/mushafs/{mushafId}/{surahId}
  // ============================================
  async getArabicText(nomor: number, mushafId: string): Promise<ArabicResult> {
    const cacheKey = `arab_${mushafId}_${nomor}`;
    const cached = quranCache.get<ArabicResult>(cacheKey);
    if (cached) return cached;

    // a. Quranpedia — mushafId HARUS angka (ID asli dari /v1/mushafs)
    if (/^\d+$/.test(mushafId)) {
      const url = `https://api.quranpedia.net/v1/mushafs/${mushafId}/${nomor}`;
      try {
        const { data } = await axios.get(url, { timeout: 15000 });
        const list: any[] = Array.isArray(data) ? data : [];

        if (list.length > 0 && list[0].text) {
          const result: ArabicResult = {
            source: 'quranpedia',
            ayahs: list.map((a, i) => {
              const number = a.number ?? i + 1;
              return {
                number,
                text: a.text,
                // nomor ayat ini di Hafs (dipakai untuk mencocokkan terjemahan)
                hafsNumbers:
                  Array.isArray(a.number_in_hafs) && a.number_in_hafs.length
                    ? a.number_in_hafs
                    : [number],
              };
            }),
          };
          quranCache.set(cacheKey, result);
          console.log(`✅ Quranpedia OK: mushaf ${mushafId}, surah ${nomor}, ${list.length} ayat`);
          return result;
        }
        console.warn(`⚠️ Quranpedia balas 200 tapi struktur tidak dikenali (${url}):`,
          JSON.stringify(data).substring(0, 200));
      } catch (e: any) {
        console.warn(`❌ Quranpedia gagal (${url}) → status: ${e.response?.status ?? 'no-response'} | ${e.message}`);
      }
    } else {
      console.warn(`⚠️ mushafId "${mushafId}" bukan angka. Pakai ID dari /api/mushafs (contoh: 1).`);
    }

    // b. Fallback: AlQuran.cloud (Hafs)
    const res = await axios.get(
      `https://api.alquran.cloud/v1/surah/${nomor}/quran-uthmani`,
      { timeout: 15000 }
    );
    if (res.data.code !== 200 || !res.data.data?.ayahs) {
      throw new Error('AlQuran.cloud gagal mengembalikan data Hafs');
    }
    const result: ArabicResult = {
      source: 'alquran.cloud',
      ayahs: res.data.data.ayahs.map((a: any) => ({
        number: a.numberInSurah,
        text: a.text,
        hafsNumbers: [a.numberInSurah],
      })),
    };
    // TTL pendek: supaya request berikutnya mencoba Quranpedia lagi
    quranCache.set(cacheKey, result, 5 * 60);
    return result;
  },

  // ============================================
  // 3b. DETAIL SURAH MERGED (Versi Baru: Audio Quranpedia)
  // Teks Arab  : Quranpedia (sesuai mushafId), fallback AlQuran.cloud
  // Terjemahan : EQuran.id (Kemenag) — Latin
  // Audio      : Quranpedia (Dinamis berdasarkan reciter & mushaf)
  // ============================================
  async getSurahDetailMerged(nomor: number, mushafId: string = '1', reciterId: string = '114') {
    try {
      console.log(`\n[MERGED] surah=${nomor} mushafId=${mushafId} reciterId=${reciterId}`);

      // 1. Ambil Info Reciter untuk mendapatkan base URL server
      const reciters = await EquranService.getReciters();
      const reciter = reciters.find((r: any) => r.id === String(reciterId)) || reciters[0];
      
      if (!reciter) throw new Error('Qari tidak ditemukan');

      // 2. EQuran.id: Hanya untuk Terjemahan & Latin (Hafs)
      const equranRes = await axios.get(`${BASE_URL}/surat/${nomor}`, { timeout: 15000 });
      if (equranRes.data.code !== 200) throw new Error('EQuran.id gagal');

      const eq = equranRes.data.data;
      const translationData: any[] = eq.ayat || [];

      // 3. Teks Arab sesuai mushaf
      const arab = await EquranService.getArabicText(nomor, mushafId);

      // 4. Nama mushaf untuk UI
      const mushafList = ((await EquranService.getMushafList().catch(() => [])) as any[]) || [];
      const mushafName =
        mushafList.find((m: any) => m.id === String(mushafId))?.name ||
        (arab.source === 'quranpedia' ? `Mushaf ${mushafId}` : 'Hafs (Standar Madinah)');

      // 5. Index terjemahan berdasarkan nomor ayat Hafs
      const translationByNo = new Map<number, any>();
      translationData.forEach((t: any) => translationByNo.set(t.nomorAyat, t));

      // 6. Gabungkan & BANGUN URL AUDIO QURANPEDIA
      const mergedAyat = arab.ayahs.map((a) => {
        const refs = a.hafsNumbers.map((n) => translationByNo.get(n)).filter(Boolean);
        
        // Konstruksi URL Audio Dinamis: {server}/{mushaf_id}/{nomor_surah}/{nomor_ayat}.mp3
        const audioUrl = `${reciter.server}/${mushafId}/${nomor}/${a.number}.mp3`;

        return {
          nomor: a.number,
          teksArab: a.text,
          teksLatin: refs.map((r: any) => r.teksLatin).filter(Boolean).join(' '),
          teksIndonesia:
            refs.map((r: any) => r.teksIndonesia).filter(Boolean).join(' ') ||
            'Terjemahan tidak tersedia',
          audio: audioUrl, // <-- PENGGANTI AUDIO EQURAN
        };
      });

      // Audio Full Surah: {server}/{mushaf_id}/{nomor_surah}.mp3
      const audioFull = `${reciter.server}/${mushafId}/${nomor}.mp3`;

      return {
        info: {
          nomor: eq.nomor || nomor,
          nama: eq.nama ?? eq.info?.nama,
          namaLatin: eq.namaLatin ?? eq.info?.namaLatin,
          arti: eq.arti ?? eq.info?.arti,
          jumlahAyat: mergedAyat.length,
          tempatTurun: eq.tempatTurun ?? eq.info?.tempatTurun,
          mushafId,
          mushafAktif: mushafName,
          sumberArab: arab.source,
          reciterAktif: reciter.nameLatin || reciter.name,
          isPerAyah: reciter.isPerAyah,
        },
        audioFull: audioFull,
        ayat: mergedAyat,
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