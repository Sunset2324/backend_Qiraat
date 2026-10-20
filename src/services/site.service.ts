import axios from 'axios';
import { randomUUID } from 'crypto';

// Data landing page (umpan balik + catatan unduhan). Menggantikan Supabase milik Bolt.
// Disimpan di Upstash Redis (REST); tanpa env UPSTASH_* dipakai memori proses (hanya uji lokal).
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX_KEEP = 2000;

export interface FeedbackRow { id: string; name: string; email: string; message: string; createdAt: string }
export interface DownloadRow { id: string; deviceType: string; userAgent: string; version: string; createdAt: string }

const mem: Record<string, string[]> = {};
const counters: Record<string, number> = {};
const upstash = () => !!(URL_ && TOKEN);

async function redis(cmd: (string | number)[]): Promise<any> {
  const r = await axios.post(URL_ as string, cmd, { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 8000 });
  return r.data?.result;
}

async function push(key: string, value: unknown): Promise<void> {
  const s = JSON.stringify(value);
  if (!upstash()) {
    (mem[key] ||= []).unshift(s);
    mem[key].length = Math.min(mem[key].length, MAX_KEEP);
    return;
  }
  await redis(['LPUSH', key, s]);
  await redis(['LTRIM', key, 0, MAX_KEEP - 1]);
}

async function list<T>(key: string, limit: number): Promise<T[]> {
  const raw: string[] = upstash() ? (await redis(['LRANGE', key, 0, limit - 1])) ?? [] : (mem[key] ?? []).slice(0, limit);
  return raw.map((x) => {
    try {
      return JSON.parse(x) as T;
    } catch {
      return null as unknown as T;
    }
  }).filter(Boolean);
}

async function incr(key: string): Promise<number> {
  if (!upstash()) return (counters[key] = (counters[key] ?? 0) + 1);
  return Number(await redis(['INCR', key]));
}

async function getCount(key: string): Promise<number> {
  if (!upstash()) return counters[key] ?? 0;
  return Number((await redis(['GET', key])) ?? 0);
}

export const SiteService = {
  async addFeedback(i: { name: string; email: string; message: string }): Promise<void> {
    const row: FeedbackRow = { id: randomUUID(), ...i, createdAt: new Date().toISOString() };
    await push('qiraat:site:feedback', row);
  },
  async addDownload(i: { deviceType: string; userAgent: string; version: string }): Promise<void> {
    const row: DownloadRow = { id: randomUUID(), ...i, createdAt: new Date().toISOString() };
    await push('qiraat:site:downloads', row);
    await incr('qiraat:site:downloads:count');
  },
  listFeedback: (limit = 200) => list<FeedbackRow>('qiraat:site:feedback', limit),
  listDownloads: (limit = 200) => list<DownloadRow>('qiraat:site:downloads', limit),
  downloadCount: () => getCount('qiraat:site:downloads:count'),
};
