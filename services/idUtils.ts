// utilsId.ts
// Utilitas untuk menghasilkan dan mengelola ID dalam koleksi data

/**
 * Koleksi yang secara default menggunakan UUID saat kosong
 * @constant
 */
export const KOLEKSI_DENGAN_UUID_DEFAULT = new Set<string>(["produk", "item"]);

/**
 * Menghasilkan UUID pendek (8 karakter pertama)
 * @returns {string} UUID pendek
 *
 * @logika
 * - Jika crypto.randomUUID tersedia, gunakan UUID standar dan ambil 8 karakter pertama
 * - Jika tidak, hasilkan string acak 8 karakter sebagai fallback
 *
 * @contohPenggunaan
 * ```
 * const id = hasilkanUuidPendek();
 * console.log(id); // "f47ac10b"
 * ```
 */
export function hasilkanUuidPendek(): string {
  return crypto?.randomUUID ? crypto.randomUUID().split("-")[0] : Math.random().toString(36).slice(2, 10);
}

/**
 * Memeriksa apakah strategi ID untuk koleksi adalah numerik
 * @param id - Array ID yang akan diperiksa
 * @returns {boolean} true jika semua ID numerik dan array tidak kosong
 *
 * @catatan
 * Fungsi ini menentukan strategi ID berdasarkan ID yang sudah ada:
 * - Jika semua ID numerik, maka strateginya numerik
 * - Jika array kosong, strategi akan ditentukan oleh koleksi
 */
export function apakahStrategiIdNumerik(id: unknown[]): boolean {
  const arrayTidakKosong = id.length > 0;
  const semuaNumerik = id.every((nilai) => typeof nilai === 'number');

  return arrayTidakKosong && semuaNumerik;
}

/**
 * Menghasilkan ID baru untuk koleksi berdasarkan strategi ID yang ada
 * @param idYangAda - Array ID yang sudah ada dalam koleksi
 * @param namaKoleksi - Nama koleksi (opsional, untuk menentukan strategi default)
 * @returns {string | number} ID baru yang sesuai dengan strategi koleksi
 *
 * @logikaGenerasi
 * 1. Jika koleksi kosong:
 *    - Koleksi default UUID → hasilkan UUID pendek
 *    - Lainnya → mulai dari 1
 * 2. Jika koleksi menggunakan strategi numerik → hasilkan angka berikutnya
 * 3. Jika koleksi menggunakan strategi string → hasilkan UUID pendek
 *
 * @contohPenggunaan
 * ```
 * // Koleksi kosong dengan default UUID
 * const id1 = hasilkanIdUntukKoleksi([], 'produk');
 * console.log(id1); // "f47ac10b" (UUID pendek)
 *
 * // Koleksi kosong tanpa default UUID
 * const id2 = hasilkanIdUntukKoleksi([], 'pengguna');
 * console.log(id2); // 1
 *
 * // Koleksi dengan ID numerik
 * const id3 = hasilkanIdUntukKoleksi([1, 2, 3], 'pengguna');
 * console.log(id3); // 4
 *
 * // Koleksi dengan ID string
 * const id4 = hasilkanIdUntukKoleksi(['abc', 'def'], 'produk');
 * console.log(id4); // "ghi12345" (UUID pendek baru)
 * ```
 */
export function hasilkanIdUntukKoleksi(idYangAda: unknown[], namaKoleksi?: string): string | number {
  // Jika koleksi kosong, tentukan strategi berdasarkan nama koleksi
  if (!idYangAda || idYangAda.length === 0) {
    if (namaKoleksi && KOLEKSI_DENGAN_UUID_DEFAULT.has(namaKoleksi)) {
      return hasilkanUuidPendek();
    }
    return 1;
  }

  // Jika koleksi menggunakan strategi numerik, hasilkan angka berikutnya
  if (apakahStrategiIdNumerik(idYangAda)) {
    const angka = idYangAda as number[];
    const maksimum = angka.reduce((a, b) => (b > a ? b : a), 0);
    return maksimum + 1;
  }

  // Default: hasilkan UUID pendek
  return hasilkanUuidPendek();
}

// Alias untuk kompatibilitas mundur (Bahasa Inggris)
export const generateIdForCollection = hasilkanIdUntukKoleksi;
export const generateShortUuid = hasilkanUuidPendek;
export const isNumericIdStrategy = apakahStrategiIdNumerik;
export const DEFAULT_UUID_COLLECTIONS = KOLEKSI_DENGAN_UUID_DEFAULT;
