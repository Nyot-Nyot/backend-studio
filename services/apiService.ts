// layananAPI.ts
// Layanan tiruan (stub) API yang digunakan oleh LayananSkenario untuk pengujian dan simulasi

/**
 * Antarmuka untuk data pengguna acak yang dikembalikan oleh fungsi ambilPenggunaAcak
 * @interface DataPenggunaAcak
 */
interface DataPenggunaAcak {
  /** ID unik pengguna (diambil dari bagian pertama UUID) */
  id: string;
  /** Nama pengguna */
  nama: string;
}

/**
 * Fungsi tiruan (stub) untuk mengambil data pengguna acak dari API.
 *
 * Fungsi ini digunakan untuk simulasi dan pengujian saat layanan API sebenarnya belum tersedia
 * atau tidak ingin melakukan panggilan jaringan yang sesungguhnya. Fungsi ini selalu mengembalikan
 * data dengan struktur yang konsisten untuk memastikan keterandalan dalam skenario pengujian.
 *
 * @returns {Promise<DataPenggunaAcak>} Promise yang mengembalikan objek pengguna acak dengan struktur tetap
 *
 * @contohPenggunaan
 * ```
 * // Dalam pengujian atau skenario simulasi
 * const pengguna = await ambilPenggunaAcak();
 * console.log(pengguna.id); // "f47ac10b" (contoh ID)
 * console.log(pengguna.nama); // "Pengguna Acak"
 * ```
 *
 * @catatan
 * - ID dihasilkan dari 8 karakter pertama UUID acak untuk mensimulasikan ID yang unik
 * - Nama pengguna selalu "Pengguna Acak" untuk konsistensi dalam pengujian
 * - Fungsi ini asynchronous (mengembalikan Promise) untuk meniru perilaku panggilan API sesungguhnya
 *
 * @performa
 * - Fungsi ini sangat ringan dan cepat karena hanya menghasilkan data statis
 * - Cocok untuk digunakan dalam pengujian unit dan skenario simulasi tanpa ketergantungan eksternal
 */
export const ambilPenggunaAcak = async (): Promise<DataPenggunaAcak> => {
  // Hasilkan UUID acak dan ambil 8 karakter pertama sebagai ID sederhana
  // Ini memberikan ID yang terlihat seperti hash untuk simulasi
  const uuidLengkap = crypto.randomUUID();
  const idSederhana = uuidLengkap.split('-')[0];

  // Kembalikan objek dengan struktur yang konsisten
  // Struktur ini stabil dan dapat diandalkan untuk semua skenario pengujian
  const dataPengguna: DataPenggunaAcak = {
    id: idSederhana,
    nama: 'Pengguna Acak'
  };

  return dataPengguna;
};

/**
 * Versi sinkron dari fungsi ambilPenggunaAcak untuk kasus penggunaan yang tidak memerlukan async
 *
 * @returns {DataPenggunaAcak} Objek pengguna acak dengan struktur yang sama seperti versi async
 *
 * @contohPenggunaan
 * ```
 * // Ketika tidak memerlukan Promise (misalnya dalam pengujian sederhana)
 * const pengguna = ambilPenggunaAcakSinkron();
 * ```
 */
export const ambilPenggunaAcakSinkron = (): DataPenggunaAcak => {
  const uuidLengkap = crypto.randomUUID();
  const idSederhana = uuidLengkap.split('-')[0];

  return {
    id: idSederhana,
    nama: 'Pengguna Acak'
  };
};
