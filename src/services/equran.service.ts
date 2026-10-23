import axios from 'axios';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import { ReciterService, sameRawi, normalizeArabic, KNOWN_RAWI } from './Reciter.service';

dotenv.config();

const quranCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 }); 
const shalatCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); 
// Daftar provinsi & kab/kota hampir tidak pernah berubah
const lokasiCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });


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

    return this.getArabicFallback(nomor);
  },

  /** Teks Hafs dari AlQuran.cloud (cadangan bila Quranpedia gagal / tidak lengkap). */
  async getArabicFallback(nomor: number): Promise<ArabicResult> {
    const cacheKey = `arab_fallback_${nomor}`;
    const cached = quranCache.get<ArabicResult>(cacheKey);
    if (cached) return cached;
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


  /** Rawi dari sebuah mushaf (null kalau tidak diketahui). */
  async getMushafRawi(mushafId: string): Promise<string | null> {
    if (!/^\d+$/.test(mushafId)) return 'حفص'; // fallback AlQuran.cloud = Hafs
    const list = ((await this.getMushafList().catch(() => [])) as any[]) || [];
    return list.find((m: any) => m.id === String(mushafId))?.rawi ?? null;
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

      // 2. Qari harus membaca RIWAYAT yang sama dengan mushaf. Penomoran ayat tiap riwayat
      //    berbeda (mis. Ar-Rahman: Hafs 78 ayat, Warsh 77 ayat), jadi audio qari riwayat lain
      //    tidak akan sejajar dengan teks.
      const mushafRawi = await this.getMushafRawi(mushafId);
      const isHafsMushaf = sameRawi(mushafRawi, 'حفص');

      let reciter = reciterId ? await ReciterService.getById(reciterId).catch(() => undefined) : undefined;
      if (reciter && mushafRawi && !sameRawi(reciter.rawi, mushafRawi)) {
        console.warn(`[MERGED] qari ${reciter.id} (${reciter.rawi}) tidak cocok dengan mushaf ${mushafId} (${mushafRawi}) -> diabaikan`);
        reciter = undefined;
      }
      // Riwayat selain Hafs: pilih otomatis qari yang cocok (audio EQuran.id hanya untuk Hafs)
      if (!reciter && mushafRawi && !isHafsMushaf) {
        const all = await ReciterService.getAll().catch(() => []);
        const candidates = all.filter((r) => sameRawi(r.rawi, mushafRawi) && r.surahs.includes(nomor));
        reciter = candidates.find((r) => r.perAyah) ?? candidates[0];
      }

      if (reciter) {
        audioFullUrl = ReciterService.fullSurahUrl(reciter, nomor);
      } else if (mushafRawi && !isHafsMushaf) {
        audioFullUrl = ''; // jangan putar audio Hafs di atas teks riwayat lain
      }

      // 3. Teks Arab sesuai mushaf
      let arab = await this.getArabicText(nomor, mushafId);

      // 3b. Pengaman kelengkapan ayat
      const expected: number = eq.jumlahAyat ?? (eq.ayat || []).length;
      if (isHafsMushaf && arab.source === 'quranpedia' && expected && arab.ayahs.length !== expected) {
        // Jumlah ayat Hafs harus sama persis; kalau beda berarti data mushaf ini tidak lengkap
        console.warn(`[MERGED] mushaf ${mushafId} surah ${nomor}: ${arab.ayahs.length} ayat, seharusnya ${expected} -> fallback AlQuran.cloud`);
        arab = await this.getArabicFallback(nomor);
      }
      const covered = new Set<number>();
      arab.ayahs.forEach((a) => a.hafsNumbers.forEach((n) => covered.add(n)));
      const missingHafs: number[] = [];
      for (let n = 1; n <= expected; n++) if (!covered.has(n)) missingHafs.push(n);
      if (missingHafs.length) console.warn(`[MERGED] surah ${nomor} mushaf ${mushafId}: ayat Hafs tidak terwakili: ${missingHafs.join(',')}`);

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
            : (!mushafRawi || isHafsMushaf) && refs[0]?.audio ? (refs[0].audio[qariId] || refs[0].audio['05'] || '') : '',
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
          rawi: mushafRawi,
          ayatTidakLengkap: missingHafs,
          sumberAudio: reciter ? 'quranpedia' : (mushafRawi && !isHafsMushaf ? 'none' : 'equran'),
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
    const cacheKey = 'quranpedia_mushafs_translated_v3';
    const cached = quranCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/mushafs');
      let rawList = Array.isArray(data) ? data : (data?.data || data?.mushafs || []);

      const textOf = (v: any): string | null =>
        typeof v === 'string' ? v : v && typeof v === 'object' ? (v.name ?? v.ar_name ?? null) : null;

      const mappedData = rawList.map((item: any) => {
        const name = item.name || item.nama || 'Mushaf Tidak Dikenal';
        // Rawi dari Quranpedia; kalau tidak ada, tebak dari nama mushaf ("مصحف ورش" -> ورش)
        let rawi = textOf(item.rawi);
        if (!rawi) {
          const n = normalizeArabic(name);
          rawi = KNOWN_RAWI.find((k) => n.includes(normalizeArabic(k))) ?? null;
          if (!rawi && /التجويد/.test(name)) rawi = 'حفص'; // mushaf tajwid berwarna = Hafs
        }
        return {
          id: String(item.id || item.slug || item.kode || Math.random().toString(36)),
          name,
          arabic: name,
          rawi,
          riwayah: textOf(item.riwayah),
          description: item.description || item.deskripsi || "Mushaf Al-Qur'an dengan riwayat yang diakui.",
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
      
      // 2. Fallback ke API Aladhan, memakai NAMA KOTA yang dipilih user
      //    (sebelumnya selalu koordinat Jakarta, sehingga kota lain salah jamnya)
      try {
        const kota = kabkota.replace(/^(kota|kab\.?|kabupaten)\s+/i, '').trim();
        const { data } = await axios.get(
          `https://api.aladhan.com/v1/calendarByCity/${tahun}/${bulan}`,
          { params: { city: kota, country: 'Indonesia', method: 20 }, timeout: 10000 }
        );

        if (data.code === 200 && Array.isArray(data.data)) {
          // Samakan bentuknya dengan EQuran.id: { provinsi, kabkota, jadwal: [...] }
          const jadwal = data.data.map((item: any) => {
            const [dd, mm, yyyy] = String(item.date.gregorian.date).split('-'); // DD-MM-YYYY
            const jam = (v: string) => String(v).split(' ')[0];
            return {
              tanggal: parseInt(dd, 10),
              tanggal_lengkap: `${yyyy}-${mm}-${dd}`,
              imsak: jam(item.timings.Imsak),
              subuh: jam(item.timings.Fajr),
              terbit: jam(item.timings.Sunrise),
              dhuha: jam(item.timings.Sunrise),
              dzuhur: jam(item.timings.Dhuhr),
              ashar: jam(item.timings.Asr),
              maghrib: jam(item.timings.Maghrib),
              isya: jam(item.timings.Isha),
            };
          });
          const transformedData = { provinsi, kabkota, bulan, tahun, sumber: 'aladhan', jadwal };
          // cache pendek: fallback tidak boleh menutupi EQuran.id terlalu lama
          shalatCache.set(cacheKey, transformedData, 60 * 60);
          return transformedData;
        }
      } catch (fallbackError: any) {
        console.error('❌ API Aladhan juga gagal:', fallbackError.message);
      }

      // Jika semua gagal, lempar error agar frontend tahu
      throw new Error('Gagal mengambil jadwal shalat dari semua sumber');
    }
  },

  async getProvinsiShalat(): Promise<string[]> {
    const cached = lokasiCache.get<string[]>('provinsi');
    if (cached) return cached;
    const { data } = await axios.get(`${BASE_URL}/shalat/provinsi`, { timeout: 10000 });
    if (data.code === 200 && Array.isArray(data.data)) {
      lokasiCache.set('provinsi', data.data);
      return data.data;
    }
    throw new Error('Gagal mengambil daftar provinsi');
  },

  async getKabKotaShalat(provinsi: string): Promise<string[]> {
    const key = `kabkota_${provinsi}`;
    const cached = lokasiCache.get<string[]>(key);
    if (cached) return cached;
    const { data } = await axios.post(`${BASE_URL}/shalat/kabkota`, { provinsi }, { timeout: 10000 });
    if (data.code === 200 && Array.isArray(data.data)) {
      lokasiCache.set(key, data.data);
      return data.data;
    }
    throw new Error('Gagal mengambil daftar kabupaten/kota');
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