// env.ts
// Utilitas untuk mengakses environment variable dengan dukungan Vite (import.meta.env) dan Node.js (process.env)

/**
 * Mendapatkan environment variable dari kedua sumber:
 * 1. Vite import.meta.env pada runtime browser
 * 2. Node.js process.env selama pengujian
 *
 * @returns Objek dengan environment variable yang dimulai dengan 'VITE_'
 *
 * @contohPenggunaan
 * ```
 * const env = dapatkanEnv();
 * console.log(env.VITE_API_BASE_URL);
 * ```
 */
export const dapatkanEnv = (): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = {};

  // Ambil dari Vite import.meta.env
  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      Object.keys((import.meta as any).env).forEach((kunci) => {
        // Hanya ambil environment variable dengan prefiks VITE_
        if (String(kunci).startsWith('VITE_')) {
          env[kunci] = (import.meta as any).env[kunci];
        }
      });
    }
  } catch (errorVite) {
    // Abaikan error jika import.meta tidak tersedia
  }

  // Gabungkan dengan process.env untuk runtime Node.js
  if (typeof process !== 'undefined' && process.env) {
    Object.keys(process.env).forEach((kunci) => {
      if (kunci.startsWith('VITE_')) {
        env[kunci] = process.env[kunci];
      }
    });
  }

  return env;
};

/**
 * Mendapatkan nilai environment variable yang wajib ada
 * @param nama - Nama environment variable
 * @returns Nilai environment variable
 * @throws Error jika environment variable tidak ditemukan
 *
 * @contohPenggunaan
 * ```
 * const apiKey = envWajib('VITE_API_KEY');
 * ```
 */
export const envWajib = (nama: string): string => {
  const env = dapatkanEnv();
  const nilai = env[nama];

  if (!nilai) {
    throw new Error(`Environment variable ${nama} tidak ditemukan`);
  }

  return nilai;
};

/**
 * Memeriksa apakah semua environment variable yang diperlukan tersedia
 * @param namaArray - Array nama environment variable yang harus diperiksa
 * @returns boolean - true jika semua tersedia, false jika ada yang tidak tersedia
 *
 * @catatan
 * - Di lingkungan produksi, fungsi ini akan melempar error jika ada variable yang tidak tersedia
 * - Di lingkungan pengembangan, hanya akan menampilkan peringatan di konsol
 *
 * @contohPenggunaan
 * ```
 * const semuaTersedia = periksaYangWajib(['VITE_API_KEY', 'VITE_API_BASE_URL']);
 * if (!semuaTersedia) {
 *   console.log('Beberapa environment variable tidak tersedia');
 * }
 * ```
 */
export const periksaYangWajib = (namaArray: string[]): boolean => {
  const env = dapatkanEnv();
  const yangTidakAda = namaArray.filter((nama) => !env[nama]);

  if (yangTidakAda.length > 0) {
    const pesanError = `Environment variable yang diperlukan tidak ditemukan: ${yangTidakAda.join(', ')}`;

    // Tentukan apakah sedang di lingkungan produksi
    const apakahProduksi =
      (typeof import.meta !== 'undefined' &&
        !!(import.meta as any).env &&
        !(import.meta as any).env.DEV) ||
      (process.env.NODE_ENV === 'production');

    if (apakahProduksi) {
      throw new Error(pesanError);
    } else {
      // Di lingkungan pengembangan, hanya tampilkan peringatan
      console.warn(pesanError);
      return false;
    }
  }

  return true;
};
