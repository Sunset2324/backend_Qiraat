import axios from 'axios';
import NodeCache from 'node-cache';
import { EquranService } from './equran.service';

/**
 * Baca per halaman mengikuti halaman mushaf TIAP qiraat: setiap ayat dari Quranpedia membawa
 * `page_number` (dan `juz`) menurut penomoran mushaf itu sendiri, jadi indeks halaman dibangun
 * dari data tersebut (bukan tabel Hafs yang dipaksakan ke riwayat lain).
 */

// Indeks ringkas (halaman -> potongan ayat) cukup kecil; simpan lama.
const indexCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });
const inflight = new Map<string, Promise<PageIndex>>();

const QURANPEDIA = 'https://api.quranpedia.net/v1';

export interface PageSegment {
  surah: number;
  /** nomor ayat awal & akhir (penomoran mushaf yang dipilih) */
  from: number;
  to: number;
}
export interface PageEntry {
  page: number;
  juz: number | null;
  segments: PageSegment[];
}
export interface PageIndex {
  mushafId: string;
  totalPages: number;
  bismillah: string | null;
  pages: PageEntry[];
}

interface RawAyah {
  number?: number;
  page_number?: number | string;
  juz?: number | string;
  surah?: number | string;
}
interface RawSurah {
  id?: number | string;
  ayahs?: RawAyah[];
}

const toInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** Susun indeks halaman dari daftar surah + ayat mentah Quranpedia. (diekspor agar bisa diuji) */
export function buildIndexFromSurahs(mushafId: string, surahs: RawSurah[], bismillah: string | null): PageIndex {
  const byPage = new Map<number, PageEntry>();

  for (const s of surahs) {
    const surahNo = toInt(s.id);
    for (const a of s.ayahs ?? []) {
      const page = toInt(a.page_number);
      const number = toInt(a.number);
      const surah = toInt(a.surah) ?? surahNo;
      if (page == null || number == null || surah == null) continue;

      let entry = byPage.get(page);
      if (!entry) {
        entry = { page, juz: toInt(a.juz), segments: [] };
        byPage.set(page, entry);
      }
      const last = entry.segments[entry.segments.length - 1];
      if (last && last.surah === surah && number === last.to + 1) last.to = number;
      else entry.segments.push({ surah, from: number, to: number });
    }
  }

  const pages = [...byPage.values()].sort((a, b) => a.page - b.page);
  if (pages.length === 0) throw new Error('Data halaman tidak ditemukan untuk mushaf ini');
  return { mushafId, totalPages: pages[pages.length - 1].page, bismillah, pages };
}

async function fetchFull(mushafId: string): Promise<PageIndex> {
  const { data } = await axios.get(`${QURANPEDIA}/mushafs/${mushafId}`, {
    timeout: 60000,
    maxContentLength: 100 * 1024 * 1024,
  });
  const surahs: RawSurah[] = Array.isArray(data?.surahs) ? data.surahs : [];
  return buildIndexFromSurahs(mushafId, surahs, data?.bismillah ?? null);
}

// Cadangan: ambil surah satu per satu (114 permintaan, 6 paralel)
async function fetchPerSurah(mushafId: string): Promise<PageIndex> {
  const surahs: RawSurah[] = [];
  const nums = Array.from({ length: 114 }, (_, i) => i + 1);
  let cursor = 0;
  const worker = async () => {
    while (cursor < nums.length) {
      const n = nums[cursor++];
      const { data } = await axios.get(`${QURANPEDIA}/mushafs/${mushafId}/${n}`, { timeout: 20000 });
      surahs[n - 1] = { id: n, ayahs: Array.isArray(data) ? data : [] };
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return buildIndexFromSurahs(mushafId, surahs.filter(Boolean), null);
}

export const PageService = {
  async getIndex(mushafId: string): Promise<PageIndex> {
    if (!/^\d+$/.test(mushafId)) throw new Error('mushafId tidak valid');
    const cached = indexCache.get<PageIndex>(`pages_${mushafId}`);
    if (cached) return cached;

    const running = inflight.get(mushafId);
    if (running) return running;

    const job = (async () => {
      let idx: PageIndex;
      try {
        idx = await fetchFull(mushafId);
      } catch (e: any) {
        console.warn(`[PAGES] mushaf ${mushafId}: unduhan penuh gagal (${e?.message}) -> per surah`);
        idx = await fetchPerSurah(mushafId);
      }
      indexCache.set(`pages_${mushafId}`, idx);
      return idx;
    })().finally(() => inflight.delete(mushafId));

    inflight.set(mushafId, job);
    return job;
  },

  /** Ringkasan untuk daftar halaman: halaman, juz, dan surah/ayat pertama di halaman itu. */
  async getSummary(mushafId: string) {
    const idx = await PageService.getIndex(mushafId);
    return {
      mushafId,
      totalPages: idx.totalPages,
      pages: idx.pages.map((p) => ({
        page: p.page,
        juz: p.juz,
        surah: p.segments[0].surah,
        ayah: p.segments[0].from,
      })),
    };
  },

  /** Isi satu halaman: ayat per surah (teks Arab sesuai mushaf + latin + terjemahan). */
  async getPage(mushafId: string, page: number, qariId = '05') {
    const idx = await PageService.getIndex(mushafId);
    const entry = idx.pages.find((p) => p.page === page);
    if (!entry) throw new Error('Halaman tidak ditemukan');

    const segments = await Promise.all(
      entry.segments.map(async (seg) => {
        const d: any = await EquranService.getSurahDetailMerged(seg.surah, mushafId, qariId);
        const ayat = (d.ayat as any[])
          .filter((a) => a.nomor >= seg.from && a.nomor <= seg.to)
          .map((a) => ({
            nomor: a.nomor,
            teksArab: a.teksArab,
            teksLatin: a.teksLatin,
            teksIndonesia: a.teksIndonesia,
          }));
        return {
          surah: {
            nomor: d.info.nomor,
            nama: d.info.nama,
            namaLatin: d.info.namaLatin,
            arti: d.info.arti,
            tempatTurun: d.info.tempatTurun,
            jumlahAyat: d.info.jumlahAyat,
          },
          startsSurah: seg.from === 1,
          endsSurah: seg.to === d.info.jumlahAyat,
          ayat,
        };
      })
    );

    return {
      mushafId,
      page: entry.page,
      totalPages: idx.totalPages,
      juz: entry.juz,
      bismillah: idx.bismillah,
      segments,
    };
  },
};
