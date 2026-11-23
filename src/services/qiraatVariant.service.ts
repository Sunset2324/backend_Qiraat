import { QuranFoundationService } from './quranFoundation.service';
import { RIWAYAT, IMAMS } from '../data/qiraatStandard';

/**
 * Mengubah matriks Qira'at Quran Foundation menjadi struktur yang memakai id imam & riwayah
 * standar aplikasi (src/data/qiraatStandard.ts).
 *
 * Pemetaan dilakukan lewat NAMA (bukan angka id QF), karena id QF bisa berubah; id yang terlihat
 * di respons 23 Nov 2026 dipakai hanya sebagai cadangan.
 * Catatan isi: data QF berisi perbedaan per kata (farsy). Perbedaan cara baca umum (usul, mis.
 * isymam/imalah) tidak selalu tercakup.
 */

// Buang diakritik Latin (ā, ʿ, ḥ, ...) lalu sisakan huruf saja: "Abū Jaʿfar al-Madanī" -> "abujafaralmadani"
const key = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const IMAM_TOKENS: Array<[string, string]> = [
  ['jafar', 'abu-jafar'],
  ['yaqub', 'yaqub'],
  ['khalaf', 'khalaf-ashir'],
  ['nafi', 'nafi'],
  ['kathir', 'ibn-katsir'],
  ['katsir', 'ibn-katsir'],
  ['abuamr', 'abu-amr'],
  ['basri', 'abu-amr'],
  ['ibnamir', 'ibn-amir'],
  ['shami', 'ibn-amir'],
  ['asim', 'asim'],
  ['hamzah', 'hamzah'],
  ['kisai', 'kisai'],
];
// Cadangan bila nama tidak dikenali (id QF per 23 Nov 2026)
const IMAM_BY_QF_ID: Record<number, string> = {
  1: 'ibn-amir', 2: 'hamzah', 3: 'khalaf-ashir', 4: 'kisai', 5: 'asim',
  6: 'abu-jafar', 7: 'nafi', 8: 'ibn-katsir', 9: 'abu-amr', 10: 'yaqub',
};

const RIWAYAH_TOKENS: Record<string, string[]> = {
  qalun: ['qalun'],
  warsy: ['warsh', 'warsy'],
  bazzi: ['bazzi'],
  qunbul: ['qunbul'],
  'duri-abu-amr': ['duri'],
  susi: ['susi'],
  hisyam: ['hisham', 'hisyam'],
  'ibn-dzakwan': ['dhakwan', 'dzakwan'],
  syubah: ['shubah', 'syubah'],
  hafsh: ['hafs'],
  'khalaf-hamzah': ['khalaf'],
  khallad: ['khallad'],
  'abul-harits': ['harith', 'harits'],
  'duri-kisai': ['duri'],
  'ibn-wardan': ['wardan'],
  'ibn-jammaz': ['jammaz'],
  ruwais: ['ruwais', 'ruways'],
  rauh: ['rawh', 'rauh'],
  ishaq: ['ishaq'],
  idris: ['idris'],
};

export function mapImam(r: { id?: number; name?: string }): string | null {
  const k = key(r.name);
  const hit = IMAM_TOKENS.find(([tok]) => k.includes(tok));
  return hit?.[1] ?? (r.id != null ? IMAM_BY_QF_ID[r.id] ?? null : null);
}

/** Rawi dipetakan dengan nama + imamnya (ad-Duri dibedakan lewat imam: Abu 'Amr vs al-Kisa'i). */
export function mapRiwayah(t: { name?: string }, imamId: string | null): string | null {
  if (!imamId) return null;
  const k = key(t.name);
  const cands = RIWAYAT.filter((r) => r.imamId === imamId && (RIWAYAH_TOKENS[r.id] ?? []).some((tok) => k.includes(tok)));
  return cands.length === 1 ? cands[0].id : null;
}

export interface VariantReading {
  text: string;
  translation: string | null;
  /** imam yang seluruh rawinya membaca begini */
  imams: string[];
  /** semua riwayah yang membaca begini (imam penuh dijabarkan ke dua rawinya) */
  riwayat: string[];
  /** riwayah yang disebut khusus (bukan imam penuh), mis. Qunbul saja */
  riwayatKhusus: string[];
}
export interface VariantJuncture {
  verseKey: string;
  ayah: number;
  text: string;
  /** A = beda makna, B = beda tulisan (makna sama), C = beda ucapan saja */
  category: string | null;
  wordStart: number | null;
  wordEnd: number | null;
  readings: VariantReading[];
}

export function transformMatrix(raw: any): { junctures: VariantJuncture[]; unmapped: string[] } {
  // Respons QF: { chapter|verse: {...}, readers, transmitters, junctures, pagination } — daftar ada di level atas;
  // dibuat toleran bila suatu saat dibungkus di dalam chapter/verse.
  const pick = (k: string): any[] => {
    for (const src of [raw, raw?.chapter, raw?.verse]) if (Array.isArray(src?.[k])) return src[k];
    return [];
  };
  const readers = pick('readers');
  const transmitters = pick('transmitters');
  const unmapped: string[] = [];

  const imamOf = new Map<number, string>();
  for (const r of readers) {
    const m = mapImam(r);
    if (m) imamOf.set(Number(r.id), m);
    else unmapped.push(`reader ${r.id}: ${r.name}`);
  }
  const riwayahOf = new Map<number, string>();
  for (const t of transmitters) {
    const m = mapRiwayah(t, imamOf.get(Number(t.reader_id)) ?? null);
    if (m) riwayahOf.set(Number(t.id), m);
    else unmapped.push(`transmitter ${t.id}: ${t.name}`);
  }
  const rawiOfImam = (imamId: string) => RIWAYAT.filter((r) => r.imamId === imamId).map((r) => r.id);
  const order = (ids: string[]) => {
    const pos = (id: string) => RIWAYAT.findIndex((r) => r.id === id);
    return [...new Set(ids)].sort((a, b) => pos(a) - pos(b));
  };
  const orderImam = (ids: string[]) => {
    const pos = (id: string) => IMAMS.find((i) => i.id === id)?.urutan ?? 99;
    return [...new Set(ids)].sort((a, b) => pos(a) - pos(b));
  };

  const junctures: VariantJuncture[] = pick('junctures').map((j: any) => {
    const ayah = parseInt(String(j.verse_key ?? '').split(':')[1] ?? '', 10);
    return {
      verseKey: String(j.verse_key ?? ''),
      ayah: Number.isFinite(ayah) ? ayah : 0,
      text: String(j.text ?? ''),
      category: j.category ?? null,
      wordStart: j.start_word_position ?? j.word_position ?? null,
      wordEnd: j.end_word_position ?? j.word_position ?? null,
      readings: (Array.isArray(j.readings) ? j.readings : []).map((rd: any): VariantReading => {
        const cells: any[] = Array.isArray(rd?.matrix?.cells) ? rd.matrix.cells : [];
        const imams: string[] = [];
        const khusus: string[] = [];
        for (const c of cells) {
          if (c.type === 'reader') {
            const im = imamOf.get(Number(c.reader_id));
            if (im) imams.push(im);
          } else if (c.type === 'transmitter') {
            const rw = riwayahOf.get(Number(c.transmitter_id));
            if (rw) khusus.push(rw);
          }
        }
        return {
          text: String(rd.text_uthmani ?? rd.text ?? ''),
          translation: rd.translation ?? null,
          imams: orderImam(imams),
          riwayat: order([...imams.flatMap(rawiOfImam), ...khusus]),
          riwayatKhusus: order(khusus),
        };
      }),
    };
  });
  return { junctures, unmapped: [...new Set(unmapped)] };
}

/** Semua perbedaan di satu surah (semua halaman) atau satu ayat. */
export async function getVariants(surah: number, ayah: number | null, lang: 'en' | 'ar') {
  if (ayah) {
    const raw = await QuranFoundationService.matrixByVerse(surah, ayah, lang);
    return transformMatrix(raw);
  }
  const first: any = await QuranFoundationService.matrixByChapter(surah, 1, lang);
  const pages = Math.min(Number(first?.pagination?.total_pages) || 1, 30);
  const rest = [];
  for (let p = 2; p <= pages; p++) rest.push(await QuranFoundationService.matrixByChapter(surah, p, lang));
  const parts = [first, ...rest].map(transformMatrix);
  return {
    junctures: parts.flatMap((x) => x.junctures),
    unmapped: [...new Set(parts.flatMap((x) => x.unmapped))],
  };
}
