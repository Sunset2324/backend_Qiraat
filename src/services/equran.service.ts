import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import { ReciterService } from './Reciter.service';

dotenv.config();

const quranCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 }); 
const shalatCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); 

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
  // 3a. TEKS ARAB (helper untuk merged)
  // ============================================
  async getArabicText(nomor: number, mushafId: string): Promise<ArabicResult> {
    const cacheKey = `arab_${mushafId}_${nomor}`;
    const cached = quranCache.get<ArabicResult>(cacheKey);
    if (cached) return cached;

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
                hafsNumbers: Array.isArray(a.number_in_hafs) && a.number_in_hafs.length ? a.number_in_hafs : [number],
              };
            }),
          };
          quranCache.set(cacheKey, result);
          return result;
        }
      } catch (e: any) {
        console.warn(`❌ Quranpedia gagal (${url}) → fallback ke AlQuran.cloud`);
      }
    }

    // Fallback: AlQuran.cloud (Hafs)
    const res = await axios.get(`https://api.alquran.cloud/v1/surah/${nomor}/quran-uthmani`, { timeout: 15000 });
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
    quranCache.set(cacheKey, result, 5 * 60);
    return result;
  },

  // ============================================
  // 3b. DETAIL SURAH MERGED (Dengan Integrasi ReciterService)
  // ============================================
  async getSurahDetailMerged(nomor: number, mushafId: string = '1', qariId: string = '05', reciterId?: number) {
    try {
      console.log(`\n[MERGED] surah=${nomor} mushafId=${mushafId} reciterId=${reciterId ?? '-'}`);

      // 1. EQuran.id: terjemahan, latin, info surah
      const equranRes = await axios.get(`${BASE_URL}/surat/${nomor}`, { timeout: 15000 });
      if (equranRes.data.code !== 200) throw new Error('EQuran.id gagal');

      const eq = equranRes.data.data;
      let audioFullUrl = eq.audioFull?.[qariId] || eq.audioFull?.['05'] || '';

      // 2. Cek apakah menggunakan Reciter Quranpedia
      const reciter = reciterId ? await ReciterService.getById(reciterId).catch(() => undefined) : undefined;
      
      if (reciter) {
        // Override URL audio dengan URL dari Quranpedia
        audioFullUrl = ReciterService.fullSurahUrl(reciter, nomor);
      }

      // 3. Teks Arab sesuai mushaf
      const arab = await this.getArabicText(nomor, mushafId);

      // 4. Nama mushaf untuk UI
      const mushafList = ((await this.getMushafList().catch(() => [])) as any[]) || [];
      const mushafName = mushafList.find((m: any) => m.id === String(mushafId))?.name || (arab.source === 'quranpedia' ? `Mushaf ${mushafId}` : 'Hafs (Standar Madinah)');

      // 5. Index terjemahan berdasarkan nomor ayat Hafs
      const translationByNo = new Map<number, any>();
      (eq.ayat || []).forEach((t: any) => translationByNo.set(t.nomorAyat, t));

      // 6. Gabungkan & Bangun URL Audio
      const mergedAyat = arab.ayahs.map((a) => {
        const refs = a.hafsNumbers.map((n) => translationByNo.get(n)).filter(Boolean);
        
        return {
          nomor: a.number,
          teksArab: a.text,
          teksLatin: refs.map((r: any) => r.teksLatin).filter(Boolean).join(' '),
          teksIndonesia: refs.map((r: any) => r.teksIndonesia).filter(Boolean).join(' ') || 'Terjemahan tidak tersedia',
          // Gunakan URL Quranpedia jika reciter ada, fallback ke EQuran
          audio: reciter 
            ? ReciterService.ayahUrl(reciter, nomor, a.number) 
            : (refs[0]?.audio ? (refs[0].audio[qariId] || refs[0].audio['05'] || '') : ''),
        };
      });

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
          sumberAudio: reciter ? 'quranpedia' : 'equran',
          reciterAktif: reciter ? { id: reciter.id, nama: reciter.name, perAyah: reciter.perAyah } : null,
        },
        audioFull: audioFullUrl,
        ayat: mergedAyat,
      };
    } catch (error: any) {
      console.error('🔥 CRITICAL ERROR in getSurahDetailMerged:', error.message);
      throw new Error('Gagal memuat detail surah');
    }
  },

  // ============================================
  // 4. DAFTAR MUSHAF (Disingkat untuk fokus ke Reciter)
  // ============================================
  async getMushafList() {
    const cacheKey = 'quranpedia_mushafs_translated_v2';
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/mushafs');
      let rawList = Array.isArray(data) ? data : (data?.data || data?.mushafs || []);

      const mappedData = rawList.map((item: any) => ({
        id: String(item.id || item.slug || item.kode || Math.random().toString(36)), 
        name: item.name || item.nama || 'Mushaf Tidak Dikenal',
        arabic: item.name || '',
        description: item.description || item.deskripsi || "Mushaf Al-Qur'an dengan riwayat yang diakui."
      }));

      quranCache.set(cacheKey, mappedData);
      return mappedData;
    } catch (error: any) {
      console.error('Gagal mengambil data mushaf:', error.message);
      throw new Error('Gagal memuat daftar mushaf');
    }
  },

  // ============================================
  // 5. JADWAL SHALAT (Dengan Fallback API)
  // ============================================
  async getJadwalShalat(provinsi: string, kabkota: string, bulan: number, tahun: number = new Date().getFullYear()) {
    const cacheKey = `shalat_${provinsi}_${kabkota}_${bulan}_${tahun}`;
    const cached = shalatCache.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. Coba EQuran.id dulu
      const { data } = await axios.post(`${BASE_URL}/shalat`, { 
        provinsi, 
        kabkota, 
        bulan, 
        tahun 
      }, { timeout: 10000 });

      if (data.code === 200) {
        shalatCache.set(cacheKey, data.data);
        return data.data;
      }
      throw new Error('EQuran.id mengembalikan status bukan 200');
    } catch (error: any) {
      console.warn('⚠️ EQuran.id gagal, mencoba API fallback (aladhan.com)...');
      
      // 2. Fallback ke API Aladhan (gratis, stabil, default koordinat Jakarta)
      try {
        const latitude = -6.2088;
        const longitude = 106.8456;
        
        const { data } = await axios.get(
          `https://api.aladhan.com/v1/calendar/${tahun}/${bulan}?latitude=${latitude}&longitude=${longitude}&method=20`,
          { timeout: 10000 }
        );

        if (data.code === 200) {
          // Transformasi data Aladhan ke format yang konsisten dengan frontend kita
          const transformedData = data.data.map((item: any) => ({
            tanggal: item.date.gregorian.date, // Format: DD-MM-YYYY
            subuh: item.timings.Fajr.split(' ')[0],
            terbit: item.timings.Sunrise.split(' ')[0],
            dzuhur: item.timings.Dhuhr.split(' ')[0],
            ashar: item.timings.Asr.split(' ')[0],
            maghrib: item.timings.Maghrib.split(' ')[0],
            isya: item.timings.Isha.split(' ')[0],
          }));

          shalatCache.set(cacheKey, transformedData);
          return transformedData;
        }
      } catch (fallbackError: any) {
        console.error('❌ API Aladhan juga gagal:', fallbackError.message);
      }

      // Jika semua gagal, lempar error agar frontend tahu
      throw new Error('Gagal mengambil jadwal shalat dari semua sumber');
    }
  },

  // ============================================
  // 6. DOA & DZIKIR
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
        id: item.id, judul: item.nama, doa: item.ar, latin: item.tr, arti: item.idn, grup: item.grup, tags: item.tag
      }));
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Gagal mengambil daftar doa');
  },

  async getDetailDoa(id: number) {
    const cacheKey = `doa_detail_${id}`;
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    const { data } = await axios.get(`https://equran.id/api/doa/${id}`);
    if (data.status === 'success') {
      const item = data.data;
      const mappedData = { id: item.id, judul: item.nama, doa: item.ar, latin: item.tr, arti: item.idn, grup: item.grup, tags: item.tag, tentang: item.tentang };
      quranCache.set(cacheKey, mappedData);
      return mappedData;
    }
    throw new Error('Doa tidak ditemukan');
  }
};