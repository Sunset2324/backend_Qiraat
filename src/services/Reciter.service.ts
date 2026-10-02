import axios from 'axios';
import NodeCache from 'node-cache';

// Cache daftar qari selama 30 hari karena jarang berubah
const cache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });

// ✅ DEFINISI TIPE DATA (INTERFACE)
export interface Reciter {
  id: number;
  nama: string;
  namaLatin: string;
  server: string;
  classification: string;
  perAyah: boolean;
}

export const ReciterService = {
  /**
   * Mengambil daftar qari lengkap dari Quranpedia
   * Opsional: filter berdasarkan nama rawi (misal: 'حفص')
   */
  async getPublicList(rawi?: string): Promise<Reciter[]> {
    const cacheKey = rawi ? `reciters_${rawi}` : 'reciters_all';
    
    // ✅ Casting tipe data untuk cache agar TypeScript tahu ini adalah Array
    const cached = cache.get<Reciter[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/reciters');
      const list = Array.isArray(data) ? data : [];

      const mapped: Reciter[] = list.map((r: any) => ({
        id: Number(r.id),
        nama: r.name,
        namaLatin: r.name_latin || r.name,
        server: r.server,
        classification: r.classification || '',
        perAyah: r.classification ? r.classification.includes('آيات') : false,
      }));

      // Prioritaskan qari yang mendukung "per-ayat" agar muncul di urutan atas
      mapped.sort((a, b) => (b.perAyah ? 1 : 0) - (a.perAyah ? 1 : 0));

      // Filter jika ada parameter rawi
      const filtered = rawi 
        ? mapped.filter((r) => r.nama.includes(rawi) || r.namaLatin.toLowerCase().includes(rawi.toLowerCase())) 
        : mapped;

      cache.set(cacheKey, filtered);
      return filtered;
    } catch (error: any) {
      console.error('Gagal mengambil data reciter:', error.message);
      throw new Error('Gagal memuat daftar qari');
    }
  },

  /**
   * Mengambil detail 1 qari berdasarkan ID
   */
  async getById(id: number): Promise<Reciter> {
    const list = await this.getPublicList();
    // ✅ Sekarang TypeScript tahu 'list' adalah Array, sehingga .find() valid
    const reciter = list.find((r) => r.id === id);
    
    if (!reciter) throw new Error('Reciter tidak ditemukan');
    return reciter;
  },

  /**
   * Helper: Membuat URL audio Full Surah
   */
  fullSurahUrl(reciter: Reciter, surahNomor: number): string {
    return `${reciter.server}/${surahNomor}.mp3`;
  },

  /**
   * Helper: Membuat URL audio Per Ayat
   */
  ayahUrl(reciter: Reciter, surahNomor: number, ayatNomor: number): string {
    return `${reciter.server}/${surahNomor}/${ayatNomor}.mp3`;
  }
};