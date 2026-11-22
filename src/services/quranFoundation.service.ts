import axios from 'axios';
import NodeCache from 'node-cache';

/**
 * Quran Foundation Content API v4 — modul Qira'at (variant per kata, 10 qari' × 2 rawi).
 *
 * Akses: OAuth2 client_credentials, scope `qiraat.read`, HANYA production (tidak tersedia di prelive).
 * Kredensial diambil dari environment server; JANGAN pernah ditaruh di kode atau di aplikasi:
 *   QF_CLIENT_ID, QF_CLIENT_SECRET            (wajib, isi sendiri di dashboard hosting)
 *   QF_OAUTH_URL  (default https://oauth2.quran.foundation/oauth2/token)
 *   QF_API_BASE   (default https://apis.quran.foundation/content/api/v4)
 *   QF_SCOPE      (default qiraat.read)
 *
 * Syarat pakai (Developer Terms, 20 Nov 2026): boleh di app beriklan dengan atribusi "Quran Foundation";
 * cache maks. 1 minggu; data mentah tidak boleh didistribusikan ulang (jangan dibundel ke APK).
 *
 * BELUM DIUJI: dokumentasi menyebut prefiks "/content/api/v4/qiraat/..." dan header x-auth-token + x-client-id,
 * tetapi path persis tiap endpoint tidak tertulis di halaman yang terbaca. Path di QF_PATHS adalah dugaan
 * dan perlu dicek sekali setelah akses disetujui; cukup ubah di sini.
 */

const OAUTH_URL = process.env.QF_OAUTH_URL || 'https://oauth2.quran.foundation/oauth2/token';
const API_BASE = process.env.QF_API_BASE || 'https://apis.quran.foundation/content/api/v4';
const SCOPE = process.env.QF_SCOPE || 'qiraat.read';

export const QF_PATHS = {
  readers: '/qiraat/readers',
  matrixByChapter: (chapter: number) => `/qiraat/matrix/by_chapter/${chapter}`,
  matrixByVerse: (verseKey: string) => `/qiraat/matrix/by_verse/${verseKey}`,
};

const cache = new NodeCache({ stdTTL: 24 * 60 * 60 }); // jauh di bawah batas 1 minggu
let token: { value: string; exp: number } | null = null;

export class QfNotConfiguredError extends Error {
  constructor() {
    super('Quran Foundation belum dikonfigurasi (QF_CLIENT_ID / QF_CLIENT_SECRET kosong).');
    this.name = 'QfNotConfiguredError';
  }
}

export const isQfConfigured = () => !!(process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET);

async function getToken(): Promise<string> {
  if (!isQfConfigured()) throw new QfNotConfiguredError();
  if (token && Date.now() < token.exp) return token.value;
  const id = process.env.QF_CLIENT_ID as string;
  const secret = process.env.QF_CLIENT_SECRET as string;
  const { data } = await axios.post(
    OAUTH_URL,
    new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE }).toString(),
    {
      auth: { username: id, password: secret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  const ttl = Number(data?.expires_in) || 3600;
  token = { value: String(data.access_token), exp: Date.now() + (ttl - 60) * 1000 };
  return token.value;
}

async function qfGet<T = any>(path: string, params?: Record<string, string | number>): Promise<T> {
  const key = `${path}?${JSON.stringify(params ?? {})}`;
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const doGet = async () =>
    axios.get(`${API_BASE}${path}`, {
      params,
      headers: { 'x-auth-token': await getToken(), 'x-client-id': process.env.QF_CLIENT_ID as string },
      timeout: 15000,
    });
  let res;
  try {
    res = await doGet();
  } catch (e: any) {
    if (e?.response?.status === 401) {
      token = null; // token kedaluwarsa lebih awal -> minta ulang sekali
      res = await doGet();
    } else throw e;
  }
  cache.set(key, res.data);
  return res.data as T;
}

export const QuranFoundationService = {
  isConfigured: isQfConfigured,
  readers: (language = 'en') => qfGet(QF_PATHS.readers, { include: 'transmitters', language }),
  matrixByChapter: (chapter: number, page = 1, language = 'en') =>
    qfGet(QF_PATHS.matrixByChapter(chapter), { text_field: 'text_uthmani', page, per_page: 100, language }),
  matrixByVerse: (surah: number, ayah: number, language = 'en') =>
    qfGet(QF_PATHS.matrixByVerse(`${surah}:${ayah}`), { text_field: 'text_uthmani', language }),
};
