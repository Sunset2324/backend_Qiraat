import { normalizeArabic } from './Reciter.service';
import { RIWAYAT, IMAMS, PERSONS, SOURCES, type FrameworkId, type Riwayah } from '../data/qiraatStandard';

/**
 * Pencocokan teks riwayah dari sumber luar (Quranpedia, mp3quran) ke id riwayah standar.
 *
 * Prinsip (anti-talfiq):
 *  - Cocok hanya bila nama RAWI dan nama IMAM sama-sama ditemukan, kecuali pemetaan rawi-saja yang
 *    eksplisit (dipakai untuk field `rawi` Quranpedia yang hanya berisi nama rawi).
 *  - Bila teks menyebut "طريق ..." yang BUKAN tariq Syathibiyyah/Durrah -> ditandai `tariqLain`,
 *    sehingga tidak disajikan sebagai riwayah jalur Syathibiyyah.
 *  - Ragu = tidak cocok (null). Lebih baik tidak menampilkan daripada mencampur riwayah.
 */

export interface RiwayahMatch {
  riwayahId: string;
  /** true = tariq yang disebut sesuai standar; false = tariq lain; null = teks tidak menyebut tariq */
  tariqStandar: boolean | null;
}

const norm = (s: string | null | undefined) => normalizeArabic(s).replace(/ـ/g, '');
const has = (hay: string, needles: string[]) => needles.some((n) => hay.includes(norm(n)));

/** Cocokkan teks bebas (mis. "رواية ورش عن نافع من طريق الأزرق") ke satu riwayah. */
export function matchRiwayahText(text: string | null | undefined): RiwayahMatch | null {
  const t = norm(text);
  if (!t) return null;
  // Nama rawi harus muncul SEBELUM nama imam ("<rawi> عن <imam>"). Ini mencegah salah cocok seperti
  // "خلف عن حمزة من طريق إدريس" terbaca sebagai riwayah Idris 'an Khalaf.
  const firstPos = (needles: string[]) =>
    Math.min(...needles.map((n) => t.indexOf(norm(n))).filter((i) => i >= 0), Infinity);
  const lastPos = (needles: string[]) => Math.max(...needles.map((n) => t.lastIndexOf(norm(n))), -1);
  const hits = RIWAYAT.filter((r) => {
    const rp = firstPos(r.match.rawi);
    const ip = lastPos(r.match.imam);
    return rp !== Infinity && ip >= 0 && rp < ip;
  });
  const pick: Riwayah | undefined = hits.length === 1 ? hits[0] : undefined; // >1 = ragu -> tidak cocok
  if (!pick) return null;
  const sebutTariq = t.includes('طريق');
  return { riwayahId: pick.id, tariqStandar: sebutTariq ? has(t, pick.match.tariq) : null };
}

/**
 * Pemetaan rawi-saja (field `rawi` Quranpedia untuk MUSHAF).
 * "الدوري" -> ad-Duri 'an Abi 'Amr: mushaf ad-Duri terbitan KFGQPC (sumber teks Quranpedia) adalah riwayah 'an Abi 'Amr
 * via Abu az-Za'ra'. Untuk QARI, "الدوري" saja dianggap ragu (lihat matchReciter).
 */
const MUSHAF_RAWI_ONLY: Record<string, string> = {
  [norm('حفص')]: 'hafsh',
  [norm('ورش')]: 'warsy',
  [norm('قالون')]: 'qalun',
  [norm('شعبة')]: 'syubah',
  [norm('الدوري')]: 'duri-abu-amr',
  [norm('السوسي')]: 'susi',
  [norm('البزي')]: 'bazzi',
  [norm('قنبل')]: 'qunbul',
  [norm('هشام')]: 'hisyam',
  [norm('ابن ذكوان')]: 'ibn-dzakwan',
  [norm('خلاد')]: 'khallad',
};

export function matchMushaf(m: { name?: string | null; rawi?: string | null }): RiwayahMatch | null {
  const byName = matchRiwayahText(m.name);
  if (byName) return byName;
  const id = MUSHAF_RAWI_ONLY[norm(m.rawi)];
  return id ? { riwayahId: id, tariqStandar: null } : null;
}

/** Qari Quranpedia: nama entri biasanya "مصحف X برواية <rawi> عن <imam>". Rawi ambigu (الدوري, خلف) tanpa imam -> null. */
export function matchReciter(r: { name?: string | null; rawi?: string | null }): RiwayahMatch | null {
  const byName = matchRiwayahText(r.name);
  if (byName) return byName;
  const rawi = norm(r.rawi);
  if (rawi === norm('الدوري') || rawi === norm('خلف')) return null;
  const id = MUSHAF_RAWI_ONLY[rawi];
  return id ? { riwayahId: id, tariqStandar: null } : null;
}

export function getRiwayah(id: string): Riwayah | undefined {
  return RIWAYAT.find((r) => r.id === id);
}

export function getStandard(framework?: string) {
  const fw = (['sabah', 'asyrah-sughra'] as FrameworkId[]).includes(framework as FrameworkId)
    ? (framework as FrameworkId)
    : undefined;
  // 'asyrah-sughra' mencakup sab'ah (Durrah dibangun di atas Syathibiyyah)
  const allow = (f: FrameworkId) => !fw || f === 'sabah' || (fw === 'asyrah-sughra' && f === 'asyrah-sughra');
  const imams = IMAMS.filter((i) => allow(i.framework));
  const riwayat = RIWAYAT.filter((r) => allow(r.framework)).map(({ match, ...rest }) => rest);
  const personIds = new Set([...imams.map((i) => i.personId), ...riwayat.map((r) => r.personId)]);
  return {
    framework: fw ?? 'asyrah-sughra',
    catatan:
      "Satu konten = satu riwayah + satu tariq + satu kitab. 'asyrah-kubra (Thayyibah) belum tersedia: butuh tabel tahrirat.",
    sumber: SOURCES,
    persons: PERSONS.filter((p) => personIds.has(p.id)),
    imams,
    riwayat,
  };
}
