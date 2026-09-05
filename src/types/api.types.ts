// ... (kode interface Surah dan lainnya tetap ada di atas)

export interface DoaItem {
  id: number;
  judul: string;
  doa: string;
  latin?: string;
  arti: string;
  sumber?: string;
  grup?: string;
  tags?: string[];
}