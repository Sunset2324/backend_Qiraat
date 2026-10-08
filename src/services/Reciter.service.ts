import axios from 'axios';
import NodeCache from 'node-cache';

// Daftar reciter jarang berubah -> cache 7 hari
const reciterCache = new NodeCache({ stdTTL: 7 * 24 * 60 * 60 });
const CACHE_KEY = 'quranpedia_reciters_v1';

const QURANPEDIA_RECITERS_URL = 'https://api.quranpedia.net/v1/reciters';

/** Bentuk internal (lengkap, dipakai server untuk membangun URL audio) */
export interface ReciterEntry {
  id: number;
  reciter: string;            // nama qari (Arab)
  name: string;               // nama lengkap entri dari Quranpedia (Arab)
  rawi: string | null;        // mis. "حفص"
  recitationType: string | null; // mis. "مرتل" / "مجود"
  perAyah: boolean;           // true = file audio per ayat, false = per surah
  surahs: number[];           // surah yang tersedia
  server: string;             // base URL audio (selalu diakhiri "/")
  timingUrl: string | null;
}

/** Bentuk publik (ringan, dikirim ke aplikasi; tanpa server & daftar surah) */
export interface ReciterPublic {
  id: number;
  reciter: string;
  name: string;
  rawi: string | null;
  recitationType: string | null;
  perAyah: boolean;
  surahCount: number;
}

const pad3 = (n: number) => String(n).padStart(3, '0');

const parseSurahs = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  }
  return [];
};

// Nama entri Quranpedia berbentuk "مصحف حفص عن عاصم برواية <nama qari>".
// Ambil bagian setelah "برواية" kalau ada, kalau tidak pakai nama penuh.
const extractReciterName = (fullName: string): string => {
  const marker = 'برواية';
  const idx = fullName.indexOf(marker);
  if (idx === -1) return fullName.trim();
  const after = fullName.slice(idx + marker.length).trim();
  return after || fullName.trim();
};

const isPerAyah = (classification: any): boolean => {
  if (!classification) return false;
  if (classification.id === 2) return true;
  return /الآيات|الايات/.test(String(classification.name || ''));
};

const normalizeServer = (server: string) => (server.endsWith('/') ? server : `${server}/`);

export const ReciterService = {
  /** Ambil semua reciter (sudah diratakan dari format "dikelompokkan per qari"). */
  async getAll(): Promise<ReciterEntry[]> {
    const cached = reciterCache.get<ReciterEntry[]>(CACHE_KEY);
    if (cached) return cached;

    try {
      const { data } = await axios.get(QURANPEDIA_RECITERS_URL, { timeout: 20000 });

      // Respons berupa array of array (dikelompokkan per qari) -> ratakan.
      const flat: any[] = Array.isArray(data) ? data.flat(2) : [];

      const entries: ReciterEntry[] = [];
      for (const item of flat) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.id !== 'number' || typeof item.server !== 'string' || !item.server) continue;

        const name = String(item.name || '');
        entries.push({
          id: item.id,
          reciter: extractReciterName(name),
          name,
          rawi: item.rawi?.name ?? null,
          recitationType: item.recitation_type?.ar_name ?? null,
          perAyah: isPerAyah(item.classification),
          surahs: parseSurahs(item.surahs_list),
          server: normalizeServer(item.server),
          timingUrl: item.timing_url ?? null,
        });
      }

      if (entries.length === 0) {
        throw new Error('Struktur respons /reciters tidak dikenali atau kosong');
      }

      reciterCache.set(CACHE_KEY, entries);
      return entries;
    } catch (error: any) {
      console.error('Gagal mengambil daftar reciter Quranpedia:', error.message);
      throw new Error('Gagal memuat daftar qari');
    }
  },

  /**
   * Daftar ringan untuk aplikasi.
   * - rawi  : filter berdasarkan nama rawi (mis. "حفص")
   * - surah : hanya qari yang punya audio untuk surah ini (1-114)
   */
  async getPublicList(rawi?: string, surah?: number): Promise<ReciterPublic[]> {
    const all = await ReciterService.getAll();
    return all
      .filter((r) => !rawi || r.rawi === rawi)
      .filter((r) => !surah || r.surahs.includes(surah))
      .map((r) => ({
        id: r.id,
        reciter: r.reciter,
        name: r.name,
        rawi: r.rawi,
        recitationType: r.recitationType,
        perAyah: r.perAyah,
        surahCount: r.surahs.length,
      }));
  },

  async getById(id: number): Promise<ReciterEntry | undefined> {
    const all = await ReciterService.getAll();
    return all.find((r) => r.id === id);
  },

  // ---- Pembuat URL audio ----
  // ASUMSI POLA NAMA FILE (belum bisa diverifikasi dari sandbox, tolong tes di browser):
  //   per ayat  : {server}{SSS}{AAA}.mp3   contoh: .../001001.mp3
  //   per surah : {server}{SSS}.mp3        contoh: .../001.mp3
  // Kalau ternyata beda, cukup ubah dua fungsi di bawah ini.

  ayahUrl(r: ReciterEntry, surah: number, ayah: number): string {
    if (!r.perAyah || !r.surahs.includes(surah)) return '';
    return `${r.server}${pad3(surah)}${pad3(ayah)}.mp3`;
  },

  fullSurahUrl(r: ReciterEntry, surah: number): string {
    if (r.perAyah || !r.surahs.includes(surah)) return '';
    return `${r.server}${pad3(surah)}.mp3`;
  },
};