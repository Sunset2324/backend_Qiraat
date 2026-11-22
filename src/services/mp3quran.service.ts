import axios from 'axios';
import NodeCache from 'node-cache';
import { matchRiwayahText, type RiwayahMatch } from './qiraat.service';

/**
 * mp3quran.net API v3 (tanpa API key).
 * Dokumentasi: https://mp3quran.net/ar/api  — endpoint: /riwayat, /reciters?rewaya=, /ayat_timing, /ayat_timing/reads
 *
 * CATATAN LISENSI: situs ini tidak mencantumkan syarat penggunaan/lisensi untuk aplikasi pihak ketiga.
 * Audio hanya di-stream (tidak di-rehost). Pemilik aplikasi disarankan meminta izin tertulis sebelum rilis
 * dan mencantumkan nama qari + "mp3quran.net".
 *
 * BELUM DIUJI LANGSUNG: bentuk respons diambil dari contoh di dokumentasi resmi; semua parsing dibuat toleran.
 */

const BASE = process.env.MP3QURAN_API_BASE_URL || 'https://mp3quran.net/api/v3';
const cache = new NodeCache({ stdTTL: 24 * 60 * 60 });
const http = axios.create({ baseURL: BASE, timeout: 15000 });

const pad3 = (n: number) => String(n).padStart(3, '0');
const normServer = (s: string) => (s.endsWith('/') ? s : `${s}/`);
const listOf = (data: any, key: string): any[] =>
  Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : Array.isArray(data?.data) ? data.data : [];
const parseSurahList = (raw: unknown): number[] =>
  String(raw ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 114);

async function cached<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const v = await fn();
  cache.set(key, v, ttl ?? 24 * 60 * 60);
  return v;
}

export interface Mp3Rewaya {
  id: number;
  name: string;
  match: RiwayahMatch | null;
}

export interface Mp3Moshaf {
  id: number;
  name: string;
  server: string;
  surahTotal: number;
  surahs: number[];
  match: RiwayahMatch | null;
}

export interface Mp3Reciter {
  id: number;
  name: string;
  moshaf: Mp3Moshaf[];
}

export const Mp3QuranService = {
  /** Daftar riwayat mp3quran (nama Arab dipakai untuk pencocokan ke riwayah standar). */
  async getRiwayat(): Promise<Mp3Rewaya[]> {
    return cached('riwayat_ar', async () => {
      const { data } = await http.get('/riwayat', { params: { language: 'ar' } });
      return listOf(data, 'riwayat')
        .filter((r: any) => r && r.id != null && r.name)
        .map((r: any) => ({ id: Number(r.id), name: String(r.name), match: matchRiwayahText(String(r.name)) }));
    });
  },

  /** Qari untuk satu rewaya mp3quran. Moshaf yang namanya jelas riwayah lain dibuang (anti-talfiq). */
  async getReciters(rewayaId: number, riwayahId?: string): Promise<Mp3Reciter[]> {
    const list = await cached(`reciters_${rewayaId}`, async () => {
      const { data } = await http.get('/reciters', { params: { language: 'ar', rewaya: rewayaId } });
      return listOf(data, 'reciters')
        .filter((r: any) => r && r.id != null)
        .map(
          (r: any): Mp3Reciter => ({
            id: Number(r.id),
            name: String(r.name ?? ''),
            moshaf: (Array.isArray(r.moshaf) ? r.moshaf : [])
              .filter((m: any) => m && typeof m.server === 'string' && m.server)
              .map((m: any) => ({
                id: Number(m.id),
                name: String(m.name ?? ''),
                server: normServer(m.server),
                surahTotal: Number(m.surah_total) || 0,
                surahs: parseSurahList(m.surah_list),
                match: matchRiwayahText(String(m.name ?? '')),
              })),
          })
        );
    });
    if (!riwayahId) return list;
    return list
      .map((r) => ({
        ...r,
        // simpan moshaf yang cocok, atau yang namanya tidak menyebut riwayah apa pun (difilter oleh parameter rewaya)
        moshaf: r.moshaf.filter((m) => !m.match || (m.match.riwayahId === riwayahId && m.match.tariqStandar !== false)),
      }))
      .filter((r) => r.moshaf.length > 0);
  },

  /** URL audio satu surah. Pola {server}{SSS}.mp3 = pola umum mp3quran (BELUM DIUJI dari sandbox). */
  surahUrl(m: Mp3Moshaf, surah: number): string {
    return m.surahs.includes(surah) ? `${m.server}${pad3(surah)}.mp3` : '';
  },

  /** Daftar "read" yang punya timing per ayat; tiap entri membawa nama rewaya. */
  async getTimingReads(): Promise<Array<{ id: number; name: string; rewaya: string; folderUrl: string; match: RiwayahMatch | null }>> {
    return cached('timing_reads', async () => {
      const { data } = await http.get('/ayat_timing/reads');
      return listOf(data, 'reads').map((r: any) => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
        rewaya: String(r.rewaya ?? ''),
        folderUrl: String(r.folder_url ?? ''),
        match: matchRiwayahText(String(r.rewaya ?? '')),
      }));
    });
  },

  /** Timing per ayat (milidetik) untuk satu read + surah. */
  async getTiming(read: number, surah: number) {
    return cached(`timing_${read}_${surah}`, async () => {
      const { data } = await http.get('/ayat_timing', { params: { surah, read } });
      return listOf(data, 'timing').map((t: any) => ({
        ayah: Number(t.ayah),
        start: Number(t.start_time),
        end: Number(t.end_time),
      }));
    }, 7 * 24 * 60 * 60);
  },
};
