// logger.ts
// Sistem logger yang dapat dikonfigurasi dengan level dan implementasi yang dapat disesuaikan

/**
 * Level log yang tersedia dalam sistem
 * Urutan prioritas: debug (terendah) < info < warn < error < silent (tertinggi)
 */
export type LevelLog = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Prioritas numerik untuk setiap level log
 * Nilai yang lebih tinggi menandakan level yang lebih penting/kritis
 */
const prioritas: Record<LevelLog, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/**
 * Level log saat ini yang aktif di sistem
 * Default: 'info', dapat diubah melalui environment variable VITE_LOG_LEVEL
 */
let levelSaatIni: LevelLog =
  (typeof import.meta !== 'undefined' && (import.meta.env as any)?.VITE_LOG_LEVEL) ||
  (typeof process !== 'undefined' && (process.env as any)?.VITE_LOG_LEVEL) ||
  'info';

/**
 * Interface untuk implementasi logger
 * Mendefinisikan kontrak yang harus dipenuhi oleh implementasi logger apa pun
 */
export interface ImplementasiLogger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Implementasi default: menggunakan console dengan filter level
 */
const implementasiDefault: ImplementasiLogger = {
  debug: (...args: any[]) => {
    if (prioritas[levelSaatIni] <= prioritas.debug) console.debug('[debug]', ...args);
  },
  info: (...args: any[]) => {
    if (prioritas[levelSaatIni] <= prioritas.info) console.info('[info]', ...args);
  },
  warn: (...args: any[]) => {
    if (prioritas[levelSaatIni] <= prioritas.warn) console.warn('[warn]', ...args);
  },
  error: (...args: any[]) => {
    if (prioritas[levelSaatIni] <= prioritas.error) console.error('[error]', ...args);
  },
};

/**
 * Implementasi logger yang sedang aktif
 * Default: implementasiDefault, dapat diganti dengan implementasi kustom
 */
let implementasi: ImplementasiLogger = implementasiDefault;

/**
 * Mengatur level log sistem
 * @param level - Level log baru yang akan diterapkan
 *
 * @contohPenggunaan
 * ```
 * aturLevel('debug'); // Menetapkan level log ke debug
 * aturLevel('error'); // Hanya menampilkan error dan silent
 * ```
 */
export const aturLevel = (level: LevelLog) => {
  levelSaatIni = level;
};

/**
 * Mendapatkan level log saat ini
 * @returns Level log yang sedang aktif
 */
export const dapatkanLevel = (): LevelLog => levelSaatIni;

/**
 * Mengatur implementasi logger kustom
 * @param implementasiBaru - Implementasi logger baru atau null untuk kembali ke default
 *
 * @catatan
 * - Jika implementasiBaru adalah null, sistem akan kembali ke implementasi default
 * - Jika implementasiBaru tidak menyediakan semua metode, metode yang tidak ada akan dibuat kosong
 *
 * @contohPenggunaan
 * ```
 * // Menggunakan implementasi kustom
 * aturImplementasi({
 *   debug: (msg) => serverLog('DEBUG', msg),
 *   info: (msg) => serverLog('INFO', msg),
 *   warn: (msg) => serverLog('WARN', msg),
 *   error: (msg) => serverLog('ERROR', msg),
 * });
 *
 * // Kembali ke implementasi default
 * aturImplementasi(null);
 * ```
 */
export const aturImplementasi = (implementasiBaru: Partial<ImplementasiLogger> | null) => {
  if (!implementasiBaru) {
    implementasi = implementasiDefault;
    return;
  }

  implementasi = {
    debug: implementasiBaru.debug || (() => { }),
    info: implementasiBaru.info || (() => { }),
    warn: implementasiBaru.warn || (() => { }),
    error: implementasiBaru.error || (() => { }),
  };
};

/**
 * Factory function untuk membuat instance logger dengan nama tertentu
 * @param nama - Nama modul atau konteks untuk logger (opsional)
 * @returns Objek logger dengan metode untuk setiap level
 *
 * @contohPenggunaan
 * ```
 * const logDatabase = logger('database');
 * logDatabase.info('Koneksi database berhasil');
 * // Output: [database] [info] Koneksi database berhasil
 *
 * const logUmum = logger();
 * logUmum.warn('Peringatan umum');
 * // Output: [warn] Peringatan umum
 * ```
 */
export const logger = (nama?: string) => ({
  debug: (...args: any[]) => implementasi.debug(nama ? `[${nama}]` : '', ...args),
  info: (...args: any[]) => implementasi.info(nama ? `[${nama}]` : '', ...args),
  warn: (...args: any[]) => implementasi.warn(nama ? `[${nama}]` : '', ...args),
  error: (...args: any[]) => implementasi.error(nama ? `[${nama}]` : '', ...args),
});

/**
 * Ekspor default untuk kompatibilitas dengan import gaya CommonJS
 */
export default logger;
