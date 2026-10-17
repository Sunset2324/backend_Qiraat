import axios from 'axios';
import { randomUUID } from 'crypto';

export interface Ad {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  tema: string; // judul tema Thibbun Nabawi (label)
  surah: number;
  ayat: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  productUrl: string;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type AdInput = Omit<Ad, 'id' | 'createdAt' | 'updatedAt'>;

const KEY = 'qiraat:ads:v1';

// Vercel tidak punya disk permanen, jadi daftar iklan disimpan di Upstash Redis (REST).
// Tanpa env UPSTASH_*, dipakai memori proses (hanya untuk uji lokal; hilang saat restart).
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
let memory: Ad[] = [];

export const storeMode = (): 'upstash' | 'memory' => (URL_ && TOKEN ? 'upstash' : 'memory');

async function redis(cmd: (string | number)[]): Promise<any> {
  const r = await axios.post(URL_ as string, cmd, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 8000,
  });
  return r.data?.result;
}

async function load(): Promise<Ad[]> {
  if (storeMode() === 'memory') return memory;
  const raw = await redis(['GET', KEY]);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function save(list: Ad[]): Promise<void> {
  if (storeMode() === 'memory') {
    memory = list;
    return;
  }
  await redis(['SET', KEY, JSON.stringify(list)]);
}

const sort = (l: Ad[]) => [...l].sort((a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt));

export const AdsService = {
  async listAll(): Promise<Ad[]> {
    return sort(await load());
  },
  async listActive(): Promise<Ad[]> {
    return sort((await load()).filter((a) => a.active));
  },
  async create(input: AdInput): Promise<Ad> {
    const now = new Date().toISOString();
    const ad: Ad = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    const list = await load();
    await save([...list, ad]);
    return ad;
  },
  async update(id: string, input: AdInput): Promise<Ad | null> {
    const list = await load();
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return null;
    const ad: Ad = { ...list[i], ...input, id, updatedAt: new Date().toISOString() };
    list[i] = ad;
    await save(list);
    return ad;
  },
  async remove(id: string): Promise<boolean> {
    const list = await load();
    const next = list.filter((a) => a.id !== id);
    if (next.length === list.length) return false;
    await save(next);
    return true;
  },
};
