/**
 * Data standar qiraat untuk aplikasi.
 *
 * Kerangka:
 *  - "sabah"         : al-Qira'at as-Sab'ah, jalur asy-Syathibiyyah (ringkasan at-Taysir ad-Dani), 1 tariq per rawi.
 *  - "asyrah-sughra" : tambahan 3 imam lewat ad-Durrah al-Mudiyyah (Ibnu al-Jazari), 1 tariq per rawi.
 *  - "asyrah-kubra"  : Thayyibah an-Nasyr (±980 tariq). SENGAJA BELUM DIISI: butuh tabel tahrirat.
 *
 * Sumber: laporan riset "Sanad qiraat sabah dan asyrah" (tariq 14 rawi dikonfirmasi dari teks at-Taysir
 * bab isnad + an-Nasyr "من طريقي الشاطبية والتيسير"; tariq Durrah dari Tahbir at-Taysir).
 * Field `verified: false` = belum dikonfirmasi sumber primer -> wajib dicek muqri' sebelum ditampilkan sebagai fakta.
 *
 * Aturan talfiq: satu konten (teks/audio/variant) hanya boleh berasal dari SATU riwayah + tariq + kitab.
 * Jangan pernah mengganti diam-diam ke riwayah lain kalau data tidak tersedia.
 */

export type FrameworkId = 'sabah' | 'asyrah-sughra' | 'asyrah-kubra';

export interface Person {
  id: string;
  ar: string;
  latin: string;
  /** tahun wafat Hijriah (teks, karena sering berupa rentang/varian) */
  wafat?: string;
  kota?: string;
  verified: boolean;
  catatan?: string;
}

export interface Imam {
  id: string;
  personId: string;
  urutan: number; // 1..10
  framework: FrameworkId; // kerangka tempat imam ini pertama kali masuk
  /** Imam tujuh yang menjadi "ashl" bagi imam Durrah (belum terverifikasi) */
  ashlImamId?: string;
}

export interface Tariq {
  /** kepala tariq menurut kitab rujukan */
  ar: string;
  latin: string;
  wafat?: string;
  kitab: 'syathibiyyah-taysir' | 'durrah-tahbir';
  verified: boolean;
  catatan?: string;
}

export interface Riwayah {
  /** id stabil untuk dipakai aplikasi & cache: mis. "hafsh", "duri-abu-amr" */
  id: string;
  imamId: string;
  personId: string;
  framework: FrameworkId;
  /** "langsung" atau keterangan perantara ke imam */
  hubungan: string;
  tariq: Tariq;
  /** Label lengkap Arab: "رواية حفص عن عاصم" */
  labelAr: string;
  labelId: string;
  labelEn: string;
  /** Kunci pencocokan nama rawi (Arab, tanpa harakat) untuk sumber eksternal */
  match: {
    rawi: string[]; // mis. ["الدوري"]
    imam: string[]; // mis. ["ابي عمرو", "ابو عمرو"]
    /** kata kunci kepala tariq; dipakai menolak rekaman dari tariq lain (mis. ورش طريق الاصبهاني) */
    tariq: string[];
  };
}

export const PERSONS: Person[] = [
  // ---- 7 imam ----
  { id: 'nafi', ar: 'نافع بن عبد الرحمن المدني', latin: "Nāfi' al-Madanī", wafat: '169', kota: 'Madinah', verified: true },
  { id: 'ibn-katsir', ar: 'عبد الله بن كثير المكي', latin: 'Ibnu Katsīr al-Makkī', wafat: '120', kota: 'Makkah', verified: true },
  { id: 'abu-amr', ar: 'أبو عمرو بن العلاء البصري', latin: "Abū 'Amr al-Baṣrī", wafat: '154', kota: 'Basrah', verified: true },
  { id: 'ibn-amir', ar: 'عبد الله بن عامر الشامي', latin: "Ibnu 'Āmir asy-Syāmī", wafat: '118', kota: 'Damaskus', verified: true, catatan: "Satu sumber sekunder menulis 154; 118 dipakai mayoritas sumber." },
  { id: 'asim', ar: 'عاصم بن أبي النجود الكوفي', latin: "'Āṣim al-Kūfī", wafat: '127/128', kota: 'Kufah', verified: false, catatan: "Cek ke Ghayat an-Nihayah." },
  { id: 'hamzah', ar: 'حمزة بن حبيب الزيات', latin: 'Ḥamzah az-Zayyāt', wafat: '156', kota: 'Kufah', verified: true },
  { id: 'kisai', ar: 'علي بن حمزة الكسائي', latin: "al-Kisā'ī", wafat: '189', kota: 'Kufah', verified: true },
  // ---- 3 imam tambahan ('asyrah) ----
  { id: 'abu-jafar', ar: 'أبو جعفر يزيد بن القعقاع المدني', latin: "Abū Ja'far al-Madanī", wafat: '±130', kota: 'Madinah', verified: false, catatan: 'Varian 127/128/132.' },
  { id: 'yaqub', ar: 'يعقوب بن إسحاق الحضرمي', latin: "Ya'qūb al-Ḥaḍramī", wafat: '205', kota: 'Basrah', verified: true },
  { id: 'khalaf', ar: 'خلف بن هشام البزار', latin: 'Khalaf ibn Hisyām al-Bazzār', wafat: '229', kota: 'Baghdad', verified: true, catatan: "Satu orang, dua peran: rawi Hamzah (sab'ah) dan imam ke-10." },
  // ---- rawi ----
  { id: 'qalun', ar: 'قالون عيسى بن مينا', latin: 'Qālūn', wafat: '220', verified: true },
  { id: 'warsy', ar: 'ورش عثمان بن سعيد', latin: 'Warsy', wafat: '197', verified: true },
  { id: 'bazzi', ar: 'البزي أحمد بن محمد', latin: 'al-Bazzī', wafat: '250', verified: true },
  { id: 'qunbul', ar: 'قنبل محمد بن عبد الرحمن', latin: 'Qunbul', wafat: '291 (at-Taysir: 280)', verified: true },
  { id: 'duri', ar: 'الدوري حفص بن عمر', latin: 'ad-Dūrī', wafat: '246', verified: true, catatan: "Satu orang, rawi dua imam: Abu 'Amr dan al-Kisa'i." },
  { id: 'susi', ar: 'السوسي صالح بن زياد', latin: 'as-Sūsī', wafat: '261', verified: true },
  { id: 'hisyam', ar: 'هشام بن عمار', latin: 'Hisyām', wafat: '245', verified: true },
  { id: 'ibn-dzakwan', ar: 'عبد الله بن أحمد بن ذكوان', latin: 'Ibnu Dzakwān', wafat: '242', verified: false, catatan: 'an-Nasyr digital menulis 202 (kemungkinan salah salin); at-Taysir 242.' },
  { id: 'syubah', ar: 'شعبة أبو بكر بن عياش', latin: "Syu'bah", wafat: '193', verified: true },
  { id: 'hafsh', ar: 'حفص بن سليمان', latin: 'Ḥafṣ', wafat: '180 (at-Taysir: ±190)', verified: true },
  { id: 'khallad', ar: 'خلاد بن خالد', latin: 'Khallād', wafat: '220', verified: true },
  { id: 'abul-harits', ar: 'أبو الحارث الليث بن خالد', latin: 'Abul Ḥārits', wafat: '240', verified: true },
  { id: 'ibn-wardan', ar: 'ابن وردان عيسى', latin: 'Ibnu Wardān', wafat: '±160', verified: false },
  { id: 'ibn-jammaz', ar: 'ابن جماز سليمان بن مسلم', latin: 'Ibnu Jammāz', wafat: '±170', verified: false },
  { id: 'ruwais', ar: 'رويس محمد بن المتوكل', latin: 'Ruwais', wafat: '238', verified: false },
  { id: 'rauh', ar: 'روح بن عبد المؤمن', latin: 'Rauḥ', wafat: '234/235', verified: false },
  { id: 'ishaq', ar: 'إسحاق الوراق', latin: 'Isḥāq al-Warrāq', wafat: '280/286', verified: false, catatan: 'Sumber sekunder berbeda.' },
  { id: 'idris', ar: 'إدريس بن عبد الكريم الحداد', latin: 'Idrīs al-Ḥaddād', wafat: '292', verified: true, catatan: "Juga kepala tariq Khalaf 'an Hamzah dalam Syathibiyyah." },
];

export const IMAMS: Imam[] = [
  { id: 'nafi', personId: 'nafi', urutan: 1, framework: 'sabah' },
  { id: 'ibn-katsir', personId: 'ibn-katsir', urutan: 2, framework: 'sabah' },
  { id: 'abu-amr', personId: 'abu-amr', urutan: 3, framework: 'sabah' },
  { id: 'ibn-amir', personId: 'ibn-amir', urutan: 4, framework: 'sabah' },
  { id: 'asim', personId: 'asim', urutan: 5, framework: 'sabah' },
  { id: 'hamzah', personId: 'hamzah', urutan: 6, framework: 'sabah' },
  { id: 'kisai', personId: 'kisai', urutan: 7, framework: 'sabah' },
  { id: 'abu-jafar', personId: 'abu-jafar', urutan: 8, framework: 'asyrah-sughra', ashlImamId: 'nafi' },
  { id: 'yaqub', personId: 'yaqub', urutan: 9, framework: 'asyrah-sughra', ashlImamId: 'abu-amr' },
  { id: 'khalaf-ashir', personId: 'khalaf', urutan: 10, framework: 'asyrah-sughra', ashlImamId: 'hamzah' },
];

const S = 'syathibiyyah-taysir' as const;
const D = 'durrah-tahbir' as const;

export const RIWAYAT: Riwayah[] = [
  {
    id: 'qalun', imamId: 'nafi', personId: 'qalun', framework: 'sabah', hubungan: 'langsung',
    tariq: { ar: 'أبو نشيط محمد بن هارون', latin: 'Abū Nasyīṭ', wafat: '258', kitab: S, verified: true },
    labelAr: 'رواية قالون عن نافع', labelId: "Qalun 'an Nafi'", labelEn: "Qalun from Nafi'",
    match: { rawi: ['قالون'], imam: ['نافع'], tariq: ['نشيط'] },
  },
  {
    id: 'warsy', imamId: 'nafi', personId: 'warsy', framework: 'sabah', hubungan: 'langsung',
    tariq: { ar: 'الأزرق يوسف بن عمرو', latin: 'al-Azraq', wafat: '±240', kitab: S, verified: true },
    labelAr: 'رواية ورش عن نافع من طريق الأزرق', labelId: "Warsy 'an Nafi' (thariq al-Azraq)", labelEn: "Warsh from Nafi' (al-Azraq path)",
    match: { rawi: ['ورش'], imam: ['نافع'], tariq: ['الازرق'] },
  },
  {
    id: 'bazzi', imamId: 'ibn-katsir', personId: 'bazzi', framework: 'sabah', hubungan: 'lewat perantara',
    tariq: { ar: 'أبو ربيعة محمد بن إسحاق الربعي', latin: "Abū Rabī'ah", wafat: '294', kitab: S, verified: true },
    labelAr: 'رواية البزي عن ابن كثير', labelId: "al-Bazzi 'an Ibnu Katsir", labelEn: 'al-Bazzi from Ibn Kathir',
    match: { rawi: ['البزي'], imam: ['ابن كثير'], tariq: ['ربيعة'] },
  },
  {
    id: 'qunbul', imamId: 'ibn-katsir', personId: 'qunbul', framework: 'sabah', hubungan: 'lewat perantara',
    tariq: { ar: 'ابن مجاهد', latin: 'Ibnu Mujāhid', wafat: '324', kitab: S, verified: true },
    labelAr: 'رواية قنبل عن ابن كثير', labelId: "Qunbul 'an Ibnu Katsir", labelEn: 'Qunbul from Ibn Kathir',
    match: { rawi: ['قنبل'], imam: ['ابن كثير'], tariq: ['مجاهد'] },
  },
  {
    id: 'duri-abu-amr', imamId: 'abu-amr', personId: 'duri', framework: 'sabah', hubungan: "lewat al-Yazidi (w. 202)",
    tariq: { ar: 'أبو الزعراء عبد الرحمن بن عبدوس', latin: "Abū az-Za'rā'", wafat: '280-an', kitab: S, verified: true },
    labelAr: 'رواية الدوري عن أبي عمرو', labelId: "ad-Duri 'an Abi 'Amr", labelEn: "ad-Duri from Abu 'Amr",
    match: { rawi: ['الدوري'], imam: ['ابي عمرو', 'ابو عمرو', 'البصري'], tariq: ['الزعراء'] },
  },
  {
    id: 'susi', imamId: 'abu-amr', personId: 'susi', framework: 'sabah', hubungan: 'lewat al-Yazidi',
    tariq: { ar: 'أبو عمران موسى بن جرير', latin: 'Mūsā ibn Jarīr', wafat: '±316', kitab: S, verified: true },
    labelAr: 'رواية السوسي عن أبي عمرو', labelId: "as-Susi 'an Abi 'Amr", labelEn: "as-Susi from Abu 'Amr",
    match: { rawi: ['السوسي'], imam: ['ابي عمرو', 'ابو عمرو', 'البصري'], tariq: ['جرير'] },
  },
  {
    id: 'hisyam', imamId: 'ibn-amir', personId: 'hisyam', framework: 'sabah', hubungan: 'lewat perantara',
    tariq: { ar: 'الحلواني أحمد بن يزيد', latin: 'al-Ḥulwānī', wafat: '250', kitab: S, verified: true },
    labelAr: 'رواية هشام عن ابن عامر', labelId: "Hisyam 'an Ibnu 'Amir", labelEn: "Hisham from Ibn 'Amir",
    match: { rawi: ['هشام'], imam: ['ابن عامر'], tariq: ['الحلواني'] },
  },
  {
    id: 'ibn-dzakwan', imamId: 'ibn-amir', personId: 'ibn-dzakwan', framework: 'sabah', hubungan: 'lewat perantara',
    tariq: { ar: 'الأخفش هارون بن موسى', latin: 'al-Akhfasy', wafat: '292', kitab: S, verified: true },
    labelAr: 'رواية ابن ذكوان عن ابن عامر', labelId: "Ibnu Dzakwan 'an Ibnu 'Amir", labelEn: "Ibn Dhakwan from Ibn 'Amir",
    match: { rawi: ['ابن ذكوان'], imam: ['ابن عامر'], tariq: ['الاخفش'] },
  },
  {
    id: 'syubah', imamId: 'asim', personId: 'syubah', framework: 'sabah', hubungan: 'langsung',
    tariq: {
      ar: 'يحيى بن آدم', latin: 'Yaḥyā ibn Ādam', wafat: '203', kitab: S, verified: true,
      catatan: "Sub-jalur dari ash-Sharifini (al-Wasiti / al-Qafila'i) perlu konfirmasi muqri'.",
    },
    labelAr: 'رواية شعبة عن عاصم', labelId: "Syu'bah 'an 'Ashim", labelEn: "Shu'bah from 'Asim",
    match: { rawi: ['شعبة'], imam: ['عاصم'], tariq: ['يحيى بن ادم'] },
  },
  {
    id: 'hafsh', imamId: 'asim', personId: 'hafsh', framework: 'sabah', hubungan: 'langsung',
    tariq: { ar: 'عبيد بن الصباح', latin: "'Ubaid ibn aṣ-Ṣabbāḥ", wafat: '235', kitab: S, verified: true },
    labelAr: 'رواية حفص عن عاصم', labelId: "Hafsh 'an 'Ashim", labelEn: "Hafs from 'Asim",
    match: { rawi: ['حفص'], imam: ['عاصم'], tariq: ['الصباح'] },
  },
  {
    id: 'khalaf-hamzah', imamId: 'hamzah', personId: 'khalaf', framework: 'sabah', hubungan: 'lewat Sulaim (w. 188)',
    tariq: { ar: 'إدريس بن عبد الكريم الحداد', latin: 'Idrīs al-Ḥaddād', wafat: '292', kitab: S, verified: true },
    labelAr: 'رواية خلف عن حمزة', labelId: "Khalaf 'an Hamzah", labelEn: 'Khalaf from Hamzah',
    match: { rawi: ['خلف'], imam: ['حمزة'], tariq: ['ادريس', 'الحداد'] },
  },
  {
    id: 'khallad', imamId: 'hamzah', personId: 'khallad', framework: 'sabah', hubungan: 'lewat Sulaim',
    tariq: { ar: 'ابن شاذان محمد بن شاذان الجوهري', latin: 'Ibnu Syādzān', wafat: '286', kitab: S, verified: true },
    labelAr: 'رواية خلاد عن حمزة', labelId: "Khallad 'an Hamzah", labelEn: 'Khallad from Hamzah',
    match: { rawi: ['خلاد'], imam: ['حمزة'], tariq: ['شاذان'] },
  },
  {
    id: 'abul-harits', imamId: 'kisai', personId: 'abul-harits', framework: 'sabah', hubungan: 'langsung',
    tariq: { ar: 'محمد بن يحيى', latin: 'Muḥammad ibn Yaḥyā', wafat: '288', kitab: S, verified: true },
    labelAr: 'رواية أبي الحارث عن الكسائي', labelId: "Abul Harits 'an al-Kisa'i", labelEn: "Abu al-Harith from al-Kisa'i",
    match: { rawi: ['ابي الحارث', 'ابو الحارث', 'الليث'], imam: ['الكسائي'], tariq: ['محمد بن يحيى'] },
  },
  {
    id: 'duri-kisai', imamId: 'kisai', personId: 'duri', framework: 'sabah', hubungan: 'langsung',
    tariq: { ar: 'جعفر بن محمد النصيبي', latin: 'Ja\'far an-Naṣībī', wafat: 'sesudah 307', kitab: S, verified: true },
    labelAr: 'رواية الدوري عن الكسائي', labelId: "ad-Duri 'an al-Kisa'i", labelEn: "ad-Duri from al-Kisa'i",
    match: { rawi: ['الدوري'], imam: ['الكسائي'], tariq: ['النصيبي'] },
  },
  // ---- 'asyrah sughra (ad-Durrah) ----
  {
    id: 'ibn-wardan', imamId: 'abu-jafar', personId: 'ibn-wardan', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'الفضل بن شاذان', latin: 'al-Faḍl ibn Syādzān', kitab: D, verified: true },
    labelAr: 'رواية ابن وردان عن أبي جعفر', labelId: "Ibnu Wardan 'an Abi Ja'far", labelEn: "Ibn Wardan from Abu Ja'far",
    match: { rawi: ['ابن وردان'], imam: ['ابي جعفر', 'ابو جعفر'], tariq: ['الفضل'] },
  },
  {
    id: 'ibn-jammaz', imamId: 'abu-jafar', personId: 'ibn-jammaz', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'الهاشمي سليمان بن داود', latin: 'al-Hāsyimī', kitab: D, verified: true, catatan: "Bukan al-Hasyimi di jalur Hafsh (orang berbeda)." },
    labelAr: 'رواية ابن جماز عن أبي جعفر', labelId: "Ibnu Jammaz 'an Abi Ja'far", labelEn: "Ibn Jammaz from Abu Ja'far",
    match: { rawi: ['ابن جماز'], imam: ['ابي جعفر', 'ابو جعفر'], tariq: ['الهاشمي'] },
  },
  {
    id: 'ruwais', imamId: 'yaqub', personId: 'ruwais', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'النخاس عن التمار', latin: 'an-Nakhkhās ← at-Tammār', kitab: D, verified: true },
    labelAr: 'رواية رويس عن يعقوب', labelId: "Ruwais 'an Ya'qub", labelEn: "Ruways from Ya'qub",
    match: { rawi: ['رويس'], imam: ['يعقوب'], tariq: ['النخاس', 'التمار'] },
  },
  {
    id: 'rauh', imamId: 'yaqub', personId: 'rauh', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'ابن وهب محمد بن وهب الثقفي', latin: 'Ibnu Wahb', kitab: D, verified: true },
    labelAr: 'رواية روح عن يعقوب', labelId: "Rauh 'an Ya'qub", labelEn: "Rawh from Ya'qub",
    match: { rawi: ['روح'], imam: ['يعقوب'], tariq: ['وهب'] },
  },
  {
    id: 'ishaq', imamId: 'khalaf-ashir', personId: 'ishaq', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'السوسنجردي', latin: 'as-Sūsanjirdī', kitab: D, verified: true },
    labelAr: 'رواية إسحاق عن خلف العاشر', labelId: "Ishaq 'an Khalaf al-'Asyir", labelEn: 'Ishaq from Khalaf (10th)',
    match: { rawi: ['اسحاق'], imam: ['خلف'], tariq: ['السوسنجردي'] },
  },
  {
    id: 'idris', imamId: 'khalaf-ashir', personId: 'idris', framework: 'asyrah-sughra', hubungan: 'langsung',
    tariq: { ar: 'الشطي إبراهيم بن الحسين', latin: 'asy-Syaṭṭī', kitab: D, verified: true },
    labelAr: 'رواية إدريس عن خلف العاشر', labelId: "Idris 'an Khalaf al-'Asyir", labelEn: 'Idris from Khalaf (10th)',
    match: { rawi: ['ادريس'], imam: ['خلف'], tariq: ['الشطي'] },
  },
];

export const SOURCES = {
  syathibiyyah: "Hirz al-Amani wa Wajh at-Tahani (asy-Syathibi, w. 590 H) - ringkasan at-Taysir",
  taysir: 'at-Taysir fi al-Qira\'at as-Sab\' (ad-Dani, w. 444 H) - bab isnad',
  nasyr: "an-Nasyr fi al-Qira'at al-'Asyr (Ibnu al-Jazari) - label 'من طريقي الشاطبية والتيسير'",
  durrah: "ad-Durrah al-Mudiyyah (Ibnu al-Jazari, 823 H) + Tahbir at-Taysir untuk tariq",
};
