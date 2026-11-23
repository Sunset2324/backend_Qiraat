import { Request, Response } from 'express';
import { getStandard, getRiwayah, matchMushaf, matchReciter } from '../services/qiraat.service';
import { Mp3QuranService } from '../services/mp3quran.service';
import { QuranFoundationService, QfNotConfiguredError, QfUpstreamError } from '../services/quranFoundation.service';
import { ReciterService } from '../services/Reciter.service';
import { EquranService } from '../services/equran.service';
import { RIWAYAT } from '../data/qiraatStandard';
import { getVariants } from '../services/qiraatVariant.service';

const surahOf = (v: unknown) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 114 ? n : null;
};

/** Jalankan satu sumber; kegagalan satu sumber tidak menggagalkan yang lain. */
async function safe<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message).slice(0, 160) : 'gagal' };
  }
}

export const QiraatController = {
  /** GET /api/qiraat?framework=sabah|asyrah-sughra — data standar imam, rawi, tariq, sumber kitab. */
  standard(req: Request, res: Response) {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ success: true, data: getStandard(req.query.framework ? String(req.query.framework) : undefined) });
  },

  /**
   * GET /api/qiraat/sumber — ketersediaan data per riwayah dari setiap API:
   *  teks (Quranpedia mushaf), audio (Quranpedia reciters, mp3quran), variant (Quran Foundation).
   *  Daftar `tidakCocok` berisi entri sumber luar yang tidak bisa dipetakan dengan yakin (untuk ditinjau manual).
   */
  async sources(_req: Request, res: Response) {
    const [mushafs, reciters, mp3, timing] = await Promise.all([
      safe(() => EquranService.getMushafList() as Promise<any[]>),
      safe(() => ReciterService.getAll()),
      safe(() => Mp3QuranService.getRiwayat()),
      safe(() => Mp3QuranService.getTimingReads()),
    ]);

    const out = RIWAYAT.map((r) => ({
      id: r.id,
      framework: r.framework,
      labelAr: r.labelAr,
      labelId: r.labelId,
      teks: { quranpediaMushafIds: [] as string[] },
      audio: {
        quranpediaReciterIds: [] as number[],
        mp3quranRewaya: [] as Array<{ id: number; name: string; tariqStandar: boolean | null }>,
        mp3quranTimingReads: [] as number[],
      },
    }));
    const byId = new Map(out.map((o) => [o.id, o]));
    const tidakCocok = { quranpediaMushaf: [] as string[], quranpediaReciter: [] as string[], mp3quranRewaya: [] as string[] };

    if (mushafs.ok)
      for (const m of mushafs.data) {
        const hit = matchMushaf(m);
        if (hit) byId.get(hit.riwayahId)?.teks.quranpediaMushafIds.push(String(m.id));
        else tidakCocok.quranpediaMushaf.push(`${m.id}: ${m.name}`);
      }
    if (reciters.ok)
      for (const r of reciters.data) {
        const hit = matchReciter(r);
        if (hit) byId.get(hit.riwayahId)?.audio.quranpediaReciterIds.push(r.id);
        else tidakCocok.quranpediaReciter.push(`${r.id}: ${r.name}`);
      }
    if (mp3.ok)
      for (const w of mp3.data) {
        if (w.match) byId.get(w.match.riwayahId)?.audio.mp3quranRewaya.push({ id: w.id, name: w.name, tariqStandar: w.match.tariqStandar });
        else tidakCocok.mp3quranRewaya.push(`${w.id}: ${w.name}`);
      }
    if (timing.ok)
      for (const t of timing.data) if (t.match) byId.get(t.match.riwayahId)?.audio.mp3quranTimingReads.push(t.id);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: {
        riwayat: out,
        tidakCocok,
        statusSumber: {
          quranpediaMushaf: mushafs.ok ? 'ok' : mushafs.error,
          quranpediaReciter: reciters.ok ? 'ok' : reciters.error,
          mp3quran: mp3.ok ? 'ok' : mp3.error,
          mp3quranTiming: timing.ok ? 'ok' : timing.error,
          quranFoundation: QuranFoundationService.isConfigured() ? 'terkonfigurasi' : 'belum dikonfigurasi',
        },
      },
    });
  },

  /**
   * GET /api/qiraat/:riwayahId/qari?surah=N — qari untuk SATU riwayah dari semua sumber audio.
   * Tidak pernah mengembalikan qari riwayah lain (anti-talfiq).
   */
  async reciters(req: Request, res: Response) {
    const riwayah = getRiwayah(String(req.params.riwayahId));
    if (!riwayah) return res.status(404).json({ success: false, message: 'Riwayah tidak dikenal' });
    const surah = surahOf(req.query.surah);

    const qp = await safe(async () => {
      const all = await ReciterService.getAll();
      return all
        .filter((r) => matchReciter(r)?.riwayahId === riwayah.id)
        .filter((r) => !surah || r.surahs.includes(surah))
        .map((r) => ({
          sumber: 'quranpedia' as const,
          id: r.id,
          nama: r.reciter,
          perAyah: r.perAyah,
          audioSurah: surah && !r.perAyah ? ReciterService.fullSurahUrl(r, surah) : undefined,
        }));
    });

    const mp = await safe(async () => {
      const rewaya = (await Mp3QuranService.getRiwayat()).filter(
        (w) => w.match?.riwayahId === riwayah.id && w.match.tariqStandar !== false
      );
      const lists = await Promise.all(rewaya.map((w) => Mp3QuranService.getReciters(w.id, riwayah.id)));
      return lists.flat().flatMap((r) =>
        r.moshaf
          .filter((m) => !surah || m.surahs.includes(surah))
          .map((m) => ({
            sumber: 'mp3quran' as const,
            id: `${r.id}:${m.id}`,
            nama: r.name,
            moshaf: m.name,
            perAyah: false,
            surahTersedia: m.surahs.length,
            audioSurah: surah ? Mp3QuranService.surahUrl(m, surah) : undefined,
          }))
      );
    });

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      success: true,
      data: {
        riwayah: { id: riwayah.id, labelAr: riwayah.labelAr, labelId: riwayah.labelId, tariq: riwayah.tariq },
        qari: [...(qp.ok ? qp.data : []), ...(mp.ok ? mp.data : [])],
        statusSumber: { quranpedia: qp.ok ? 'ok' : qp.error, mp3quran: mp.ok ? 'ok' : mp.error },
        atribusi: 'Audio: nama qari + mp3quran.net / Quranpedia',
      },
    });
  },

  /** GET /api/qiraat/timing?read=ID&surah=N — waktu per ayat (ms) dari mp3quran, dengan riwayah read-nya. */
  async timing(req: Request, res: Response) {
    const read = parseInt(String(req.query.read ?? ''), 10);
    const surah = surahOf(req.query.surah);
    if (!Number.isFinite(read) || !surah) return res.status(400).json({ success: false, message: 'read dan surah wajib diisi' });
    try {
      const reads = await Mp3QuranService.getTimingReads();
      const info = reads.find((r) => r.id === read);
      const data = await Mp3QuranService.getTiming(read, surah);
      res.set('Cache-Control', 'public, max-age=86400');
      res.json({ success: true, data: { read, surah, riwayahId: info?.match?.riwayahId ?? null, rewaya: info?.rewaya ?? null, ayat: data } });
    } catch (e: any) {
      res.status(502).json({ success: false, message: 'Gagal memuat timing dari mp3quran' });
    }
  },

  /**
   * GET /api/qiraat/variant/:surah?ayah=N — variant bacaan per kata (Quran Foundation).
   * Aktif hanya bila QF_CLIENT_ID/QF_CLIENT_SECRET diisi pemilik di server.
   */
  async variants(req: Request, res: Response) {
    const surah = surahOf(req.params.surah);
    const ayah = parseInt(String(req.query.ayah ?? ''), 10);
    if (!surah) return res.status(400).json({ success: false, message: 'Nomor surah harus 1-114' });
    const lang = req.query.lang === 'ar' ? 'ar' : 'en';
    try {
      const hasAyah = Number.isFinite(ayah) && ayah > 0;
      // ?raw=1 -> respons asli QF (untuk pengecekan); default -> dipetakan ke id imam/riwayah aplikasi
      if (req.query.raw === '1') {
        const data = hasAyah
          ? await QuranFoundationService.matrixByVerse(surah, ayah, lang)
          : await QuranFoundationService.matrixByChapter(surah, 1, lang);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.json({ success: true, data, atribusi: 'Quran Foundation' });
      }
      const { junctures, unmapped } = await getVariants(surah, hasAyah ? ayah : null, lang);
      // Syarat Quran Foundation: atribusi wajib, cache klien jangan lebih dari 1 minggu
      res.set('Cache-Control', 'public, max-age=86400');
      res.json({
        success: true,
        data: { surah, ayah: hasAyah ? ayah : null, junctures, unmapped },
        atribusi: 'Quran Foundation',
        catatan: 'Perbedaan per kata (farsy). Perbedaan cara baca umum (usul) tidak selalu tercakup.',
      });
    } catch (e: any) {
      if (e instanceof QfNotConfiguredError) {
        return res.status(503).json({ success: false, code: 'QF_NOT_CONFIGURED', message: 'Data variant qiraat belum diaktifkan di server.' });
      }
      // Diagnostik aman: tahap (token/api), status HTTP, dan kode error QF — tanpa token atau secret.
      const d = e instanceof QfUpstreamError ? { tahap: e.stage, status: e.status, kode: e.upstream } : { tahap: 'lain', status: null, kode: null };
      console.error('[QF]', JSON.stringify(d));
      const scopeIssue = d.status === 403 || /scope/i.test(String(d.kode ?? ''));
      const clientIssue = d.tahap === 'token' && (d.status === 401 || /client/i.test(String(d.kode ?? '')));
      return res.status(scopeIssue || clientIssue ? 503 : 502).json({
        success: false,
        code: scopeIssue ? 'QF_SCOPE' : clientIssue ? 'QF_CLIENT' : 'QF_ERROR',
        message: scopeIssue
          ? 'Akses qiraat.read belum disetujui Quran Foundation.'
          : clientIssue
          ? 'Client ID/Secret ditolak Quran Foundation (cek kredensial production, bukan prelive).'
          : 'Gagal memuat data variant.',
        diagnostik: d,
      });
    }
  },
};
