// retry.ts
// Utilitas untuk mekanisme coba ulang (retry) dengan backoff eksponensial dan timeout

/**
 * Opsi untuk mekanisme coba ulang
 */
export type OpsiCobaUlang = {
  /** Jumlah maksimal percobaan ulang */
  retries?: number;
  /** Penundaan dasar dalam milidetik */
  baseDelayMs?: number;
  /** Faktor pengali untuk penundaan eksponensial */
  factor?: number;
  /** Penundaan maksimal dalam milidetik */
  maxDelayMs?: number;
  /** Timeout per percobaan dalam milidetik (opsional) */
  timeoutMs?: number;
};

// Ekspor alias untuk kompatibilitas mundur (Bahasa Inggris)
export type RetryOptions = OpsiCobaUlang;

/**
 * Menunda eksekusi untuk jangka waktu tertentu
 * @param ms - Waktu penundaan dalam milidetik
 * @returns Promise yang selesai setelah waktu yang ditentukan
 */
export const tidur = (ms: number) => new Promise((selesaikan) => setTimeout(selesaikan, ms));

// Ekspor alias untuk kompatibilitas mundur
export const sleep = tidur;

/**
 * Membungkus promise dengan timeout
 * @param janji - Promise yang akan dibungkus
 * @param ms - Waktu timeout dalam milidetik
 * @returns Promise yang akan selesai atau gagal jika timeout
 * @throws Error jika timeout tercapai
 */
export const denganTimeout = async <T>(janji: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  const timeout = new Promise<never>((_, tolak) => {
    timer = setTimeout(() => tolak(new Error(`timeout setelah ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([janji, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// Ekspor alias untuk kompatibilitas mundur
export const withTimeout = denganTimeout;

/**
 * Melakukan eksekusi fungsi dengan mekanisme coba ulang
 * @param fungsi - Fungsi yang akan dieksekusi (mengembalikan Promise)
 * @param opsi - Opsi konfigurasi coba ulang
 * @returns Hasil dari fungsi yang dijalankan
 * @throws Error jika semua percobaan gagal
 */
export const cobaUlang = async <T>(fungsi: () => Promise<T>, opsi: OpsiCobaUlang = {}): Promise<T> => {
  const percobaan = typeof opsi.retries === 'number' ? opsi.retries : 3;
  const dasar = typeof opsi.baseDelayMs === 'number' ? opsi.baseDelayMs : 200;
  const faktor = typeof opsi.factor === 'number' ? opsi.factor : 2;
  const penundaanMaks = typeof opsi.maxDelayMs === 'number' ? opsi.maxDelayMs : 2000;

  // Aktifkan log debug ketika DEBUG_RETRY=1 atau DEBUG_OPENROUTER=1
  const DEBUG = process.env.DEBUG_RETRY === '1' || process.env.DEBUG_OPENROUTER === '1';

  let percobaanSaatIni = 0;
  let errorTerakhir: any;

  while (percobaanSaatIni <= percobaan) {
    try {
      if (DEBUG) {
        console.log(`[cobaUlang] percobaan ${percobaanSaatIni + 1}/${percobaan + 1} timeoutMs=${opsi.timeoutMs ?? 'tidak ada'}`);
      }

      if (opsi.timeoutMs) {
        return await denganTimeout(fungsi(), opsi.timeoutMs);
      }

      return await fungsi();
    } catch (error) {
      errorTerakhir = error;

      // Jika error menandakan tidak boleh dicoba ulang (misal: rate limit atau error klien), lempar segera
      if ((error as any)?.noRetry) {
        if (DEBUG) {
          console.warn(`[cobaUlang] tidak mencoba ulang karena flag noRetry: ${String(error)}`);
        }
        throw error;
      }

      if (DEBUG) {
        console.warn(`[cobaUlang] percobaan ${percobaanSaatIni + 1} gagal: ${String(error)}${percobaanSaatIni === percobaan ? ' (tidak ada percobaan lagi)' : ', akan coba ulang'}`);
      }

      if (percobaanSaatIni === percobaan) {
        break;
      }

      // Hitung penundaan dengan backoff eksponensial
      const penundaan = Math.min(penundaanMaks, dasar * Math.pow(faktor, percobaanSaatIni));
      // Tambahkan jitter (variasi acak) untuk menghindari thundering herd
      const jitter = Math.floor(Math.random() * Math.min(100, penundaan));

      await tidur(penundaan + jitter);
      percobaanSaatIni++;
      continue;
    }
  }

  throw errorTerakhir;
};

// Ekspor alias untuk kompatibilitas mundur
export const retry = cobaUlang;

/**
 * Ekspor default untuk kompatibilitas dengan kode yang mengimpor sebagai modul default
 */
export default {
  sleep: tidur,
  withTimeout: denganTimeout,
  retry: cobaUlang,
};
