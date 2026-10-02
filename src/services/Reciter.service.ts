import axios from 'axios';
import NodeCache from 'node-cache';

// Cache daftar qari selama 30 hari karena jarang berubah
const cache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });

export const ReciterService = {
  /**
   * Mengambil daftar qari lengkap dari Quranpedia
   * Opsional: filter berdasarkan nama rawi (misal: 'حفص')
   */
  async getPublicList(rawi?: string) {
    const cacheKey = rawi ? `reciters_${rawi}` : 'reciters_all';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get('https://api.quranpedia.net/v1/reciters');
      let list = Array.isArray(data) ? data : [];

      const mapped = list.map((r: any) => ({
        id: Number(r.id),
        nama: r.name,
        namaLatin: r.name_latin || r.name,
        server: r.server,
        classification: r.classification,
        perAyah: r.classification && r.classification.includes('آيات'), // true jika mendukung per-ayat
      }));

      // Prioritaskan qari yang mendukung "per-ayat" agar muncul di urutan atas
      mapped.sort((a: any, b: any) => (b.perAyah ? 1 : 0) - (a.perAyah ? 1 : 0));

      // Filter jika ada parameter rawi
      const filtered = rawi 
        ? mapped.filter((r: any) => r.nama.includes(rawi) || r.namaLatin.toLowerCase().includes(rawi.toLowerCase())) 
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
  async getById(id: number) {
    const list = await this.getPublicList();
    const reciter = list.find((r: any) => r.id === id);
    if (!reciter) throw new Error('Reciter tidak ditemukan');
    return reciter;
  },

  /**
   * Helper: Membuat URL audio Full Surah
   */
  fullSurahUrl(reciter: any, surahNomor: number): string {
    // Pola standar Quranpedia: {server}/{nomor_surah}.mp3
    return `${reciter.server}/${surahNomor}.mp3`;
  },

  /**
   * Helper: Membuat URL audio Per Ayat
   */
  ayahUrl(reciter: any, surahNomor: number, ayatNomor: number): string {
    // Pola standar Quranpedia: {server}/{nomor_surah}/{nomor_ayat}.mp3
    return `${reciter.server}/${surahNomor}/${ayatNomor}.mp3`;
  }
};