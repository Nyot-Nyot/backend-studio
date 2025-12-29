// layananUnggah.ts
// Layanan untuk mengunggah file sementara dengan mekanisme retry dan timeout

import retryUtil from './retry';
import { UploadFailedError, UploadTimeoutError } from './uploadErrors';

/**
 * Hasil dari proses unggah file
 */
export type HasilUnggah = {
  url: string;
  expiresAt?: string
};

/**
 * Menyelesaikan URL dasar untuk layanan unggah dengan urutan prioritas yang konsisten
 * @param opsiUrl - URL eksplisit dari parameter opsi (prioritas tertinggi)
 * @returns URL dasar untuk layanan unggah
 *
 * @prioritas
 * 1. Parameter opsi.url (eksplisit)
 * 2. VITE_EMAIL_HELPER_URL dari environment Vite
 * 3. EMAIL_HELPER_URL dari environment Node.js
 * 4. Port dari environment dengan protokol HTTP/HTTPS
 * 5. Default localhost:3001
 */
const selesaikanUrlDasar = (opsiUrl?: string): string => {
  // Cek environment Vite (browser)
  const dariImportMeta = (typeof import.meta !== 'undefined' && (import.meta as any).env)
    ? (import.meta as any).env
    : undefined;

  const urlVite = dariImportMeta?.VITE_EMAIL_HELPER_URL as string | undefined;
  const portVite = dariImportMeta?.VITE_EMAIL_HELPER_PORT as string | undefined;
  const tlsVite = dariImportMeta?.VITE_EMAIL_HELPER_TLS as string | undefined; // '1' atau 'true'

  // Cek environment Node.js
  const urlEnv = process.env.EMAIL_HELPER_URL;
  const portEnv = process.env.EMAIL_HELPER_PORT;
  const tlsEnv = process.env.EMAIL_HELPER_TLS;

  // Prioritas 1: URL eksplisit dari opsi
  if (opsiUrl) return opsiUrl;

  // Prioritas 2: URL dari Vite environment
  if (urlVite) return urlVite;

  // Prioritas 3: URL dari Node.js environment
  if (urlEnv) return urlEnv;

  // Prioritas 4: Konstruksi dari port Vite dengan protokol
  if (portVite) {
    const protokol = (tlsVite === '1' || tlsVite === 'true') ? 'https' : 'http';
    return `${protokol}://localhost:${portVite}`;
  }

  // Prioritas 5: Konstruksi dari port Node.js dengan protokol
  if (portEnv) {
    const protokol = (tlsEnv === '1' || tlsEnv === 'true') ? 'https' : 'http';
    return `${protokol}://localhost:${portEnv}`;
  }

  // Prioritas 6: Default
  return 'http://localhost:3001';
};

/**
 * Membuat FormData untuk file yang akan diunggah
 * @param file - File yang akan diunggah
 * @param namaFile - Nama file (default: 'export.zip')
 * @returns Instance FormData dengan file terlampir
 */
const buatFormData = (file: Blob, namaFile: string): FormData => {
  const formData = new FormData();
  formData.append('file', file as any, namaFile);
  return formData;
};

/**
 * Melakukan permintaan unggah file ke server
 * @param urlDasar - URL dasar layanan
 * @param formData - Data form dengan file
 * @param fetchFn - Fungsi fetch yang akan digunakan
 * @returns Promise dengan hasil unggah
 * @throws UploadFailedError jika unggah gagal atau respons tidak valid
 */
const lakukanUnggah = async (
  urlDasar: string,
  formData: FormData,
  fetchFn: (input: string, init?: RequestInit) => Promise<Response>
): Promise<HasilUnggah> => {
  const urlUnggah = `${urlDasar.replace(/\/$/, '')}/upload-temp`;
  const respons = await fetchFn(urlUnggah, {
    method: 'POST',
    body: formData
  });

  const teksRespons = await respons.text();

  if (!respons.ok) {
    // Untuk error klien 4xx (kecuali 429), jangan coba ulang
    const janganCobaUlang = respons.status >= 400 && respons.status < 500 && respons.status !== 429;
    throw Object.assign(
      new UploadFailedError(
        `Unggah gagal: ${respons.status} ${respons.statusText}`,
        respons.status,
        teksRespons,
        janganCobaUlang
      ),
      { janganCobaUlang }
    );
  }

  try {
    const json = JSON.parse(teksRespons);
    return json as HasilUnggah;
  } catch (errorParsing) {
    // JSON tidak valid
    throw new UploadFailedError(
      'Unggah berhasil tetapi parsing JSON respons gagal',
      respons.status,
      teksRespons,
      false
    );
  }
};

/**
 * Mengunggah file sementara ke server dengan mekanisme retry dan timeout
 * @param file - File yang akan diunggah
 * @param namaFile - Nama file (default: 'export.zip')
 * @param opsi - Opsi tambahan untuk konfigurasi unggah
 * @returns Promise yang mengembalikan hasil unggah (URL file)
 *
 * @contohPenggunaan
 * ```
 * const file = new Blob(['konten'], { type: 'text/plain' });
 * const hasil = await unggahFileSementara(file, 'laporan.txt', {
 *   retries: 3,
 *   timeoutMs: 15000
 * });
 * console.log(hasil.url); // 'http://localhost:3001/temp/abc123'
 * ```
 *
 * @catatan
 * - Fungsi ini menggunakan mekanisme retry dengan backoff eksponensial
 * - Timeout diterapkan per percobaan unggah
 * - Error 4xx (kecuali 429) tidak akan dicoba ulang
 */
export async function unggahFileSementara(
  file: Blob,
  namaFile = 'export.zip',
  opsi?: {
    url?: string; // override URL dasar
    fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
    retries?: number; // jumlah percobaan ulang
    timeoutMs?: number; // timeout per percobaan
  }
): Promise<HasilUnggah> {
  // Selesaikan URL dasar dengan prioritas yang konsisten
  const urlDasar = selesaikanUrlDasar(opsi?.url);

  // Tentukan fungsi fetch yang akan digunakan
  const fetchFn = opsi?.fetchFn ??
    (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);

  if (!fetchFn) {
    throw new Error(
      'fetch tidak tersedia; berikan fetchFn dalam opsi untuk lingkungan ini'
    );
  }

  // Siapkan FormData untuk file
  const formData = buatFormData(file, namaFile);

  // Fungsi untuk melakukan unggah dengan penanganan error
  const fungsiUnggah = async (): Promise<HasilUnggah> => {
    return lakukanUnggah(urlDasar, formData, fetchFn);
  };

  // Konfigurasi retry
  const percobaanUlang = typeof opsi?.retries === 'number' ? opsi.retries : 2;
  const timeoutMs = typeof opsi?.timeoutMs === 'number' ? opsi.timeoutMs : 10000;

  try {
    // Jalankan unggah dengan mekanisme retry
    return await retryUtil.retry(fungsiUnggah, {
      retries: percobaanUlang,
      baseDelayMs: 250,
      factor: 2, // backoff eksponensial
      maxDelayMs: 1000,
      timeoutMs,
    });
  } catch (error: any) {
    // Tangani khusus error timeout
    if (error instanceof Error && /timeout after \d+ms/.test(error.message)) {
      throw new UploadTimeoutError(timeoutMs);
    }

    // Lempar ulang error lainnya
    throw error;
  }
}

// Backward-compatible English alias
export const uploadTempFile = unggahFileSementara;

// Default export for consumers that import the module as default
export default {
  unggahFileSementara,
  uploadTempFile,
};
