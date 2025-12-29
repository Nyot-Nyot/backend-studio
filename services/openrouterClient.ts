// klienOpenRouter.ts
// Klien untuk berinteraksi dengan layanan OpenRouter AI

/**
 * Respons dari OpenRouter untuk permintaan data tiruan
 */
export interface ResponsMockOpenRouter {
  /** Data tiruan dalam format string JSON */
  json: string
}

/**
 * Konfigurasi endpoint yang dihasilkan oleh AI
 */
export interface KonfigurasiEndpointTerbuat {
  /** Nama endpoint */
  name: string;
  /** Jalur endpoint */
  path: string;
  /** Metode HTTP */
  method: string;
  /** Kode status HTTP */
  statusCode: number;
  /** Badan respons dalam format string */
  responseBody: string
}

/**
 * Error bertipe yang dikembalikan ketika proxy OpenRouter merespons dengan kode non-2xx
 */
export class ErrorOpenRouter extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, pesan?: string) {
    super(pesan || `Error proxy OpenRouter: ${status}`);
    this.name = 'ErrorOpenRouter';
    this.status = status;
    this.body = body;
  }
}

// Backward-compatible English-shaped alias for older modules
export const OpenRouterError = ErrorOpenRouter;

/**
 * Mendapatkan variabel environment dari import.meta.env dengan aman
 * @param nama - Nama variabel environment
 * @returns Nilai variabel atau undefined jika tidak tersedia
 *
 * @catatanKeamanan
 * Fungsi ini menangani kasus di mana import.meta mungkin tidak tersedia
 * di beberapa lingkungan runtime (misalnya, Node.js tanpa dukungan ES modules)
 */
const dapatkanVariabelEnvDenganAman = (nama: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      return (import.meta as any).env && (import.meta as any).env[nama];
    }
  } catch (errorAksesEnv) {
    // import.meta mungkin tidak tersedia di beberapa runtime — abaikan dan kembalikan undefined
  }
  return undefined;
};

/**
 * Menormalkan URL dasar dengan memastikan tidak ada slash di akhir
 */
const URL_BASE_MENTAH = dapatkanVariabelEnvDenganAman('VITE_OPENROUTER_PROXY_URL');
const URL_BASE = URL_BASE_MENTAH && String(URL_BASE_MENTAH).trim() !== ''
  ? String(URL_BASE_MENTAH).replace(/\/+$/, '')
  : '';

/**
 * Melakukan permintaan POST dengan body JSON ke OpenRouter
 * @param jalur - Jalur endpoint API
 * @param badan - Data yang akan dikirim sebagai JSON
 * @param opsi - Opsi tambahan termasuk kunci klien
 * @returns Promise yang mengembalikan respons JSON
 * @throws ErrorOpenRouter jika respons tidak ok (non-2xx)
 *
 * @contohPenggunaan
 * ```
 * const data = await kirimJson('/openrouter/generate-mock', { path: '/api/users' });
 * ```
 *
 * @catatanKeamanan
 * Kunci klien hanya diteruskan jika disediakan secara eksplisit melalui opsi.clientKey
 * (tidak ada pengambilan implisit dari localStorage) untuk menghindari membaca rahasia
 * dari penyimpanan secara tidak sengaja.
 */
const kirimJson = async (
  jalur: string,
  badan: unknown,
  opsi?: { kunciKlien?: string }
): Promise<any> => {
  // pastikan jalur dimulai dengan '/'
  const jalurAman = jalur.startsWith('/') ? jalur : `/${jalur}`;
  const url = URL_BASE ? `${URL_BASE}${jalurAman}` : jalurAman;
  const header: Record<string, string> = { 'Content-Type': 'application/json' };

  // Kunci klien hanya diteruskan jika disediakan secara eksplisit melalui opsi.kunciKlien
  if (opsi && typeof opsi.kunciKlien === 'string' && opsi.kunciKlien.length > 0) {
    header['X-OpenRouter-Key'] = opsi.kunciKlien;
  }

  const respons = await fetch(url, {
    method: 'POST',
    headers: header,
    body: JSON.stringify(badan),
  });

  if (!respons.ok) {
    const teks = await respons.text().catch(() => '');
    console.error('[OpenRouter] proxy returned non-OK', { status: respons.status, text: teks });
    // lemparkan error bertipe sehingga pemanggil dapat membuat keputusan terstruktur
    throw new ErrorOpenRouter(respons.status, teks, `Error proxy OpenRouter: ${respons.status}`);
  }

  const json = await respons.json();
  // Helpful debug log for AI responses (truncated)
  try {
    const snippet = JSON.stringify(json).slice(0, 500);
    console.debug('[OpenRouter] response json snippet:', snippet);
  } catch (e) {
    console.debug('[OpenRouter] response received (could not serialize)');
  }

  return json;
};

/**
 * Meminta OpenRouter untuk menghasilkan data tiruan untuk endpoint tertentu
 * @param muatan - Data yang berisi jalur dan konteks endpoint
 * @param opsi - Opsi opsional termasuk kunci klien
 * @returns Promise yang mengembalikan respons mock OpenRouter
 *
 * @contohPenggunaan
 * ```
 * const respons = await hasilkanMockOpenRouter(
 *   { path: '/api/pengguna', context: 'Data pengguna dengan nama dan email' },
 *   { kunciKlien: 'kunci-rahasia' }
 * );
 * console.log(respons.json); // '{"nama": "Budi", "email": "budi@contoh.com"}'
 * ```
 */
export async function hasilkanMockOpenRouter(
  muatan: { path: string; context?: string },
  opsi?: { kunciKlien?: string }
): Promise<ResponsMockOpenRouter> {
  return kirimJson('/openrouter/generate-mock', muatan, opsi) as Promise<ResponsMockOpenRouter>;
}

// Backward-compatible English-shaped alias
export const openrouterGenerateMock = hasilkanMockOpenRouter;
/**
 * Meminta OpenRouter untuk menghasilkan konfigurasi endpoint berdasarkan deskripsi
 * @param muatan - Data yang berisi prompt/deskripsi endpoint
 * @param opsi - Opsi opsional termasuk kunci klien
 * @returns Promise yang mengembalikan konfigurasi endpoint yang dihasilkan
 *
 * @contohPenggunaan
 * ```
 * const konfigurasi = await hasilkanEndpointOpenRouter(
 *   { prompt: 'Buat endpoint GET untuk daftar produk' },
 *   { kunciKlien: 'kunci-rahasia' }
 * );
 * console.log(konfigurasi.name); // 'getProduk'
 * console.log(konfigurasi.path); // '/api/produk'
 * ```
 */
export async function hasilkanEndpointOpenRouter(
  muatan: { prompt: string },
  opsi?: { kunciKlien?: string }
): Promise<KonfigurasiEndpointTerbuat> {
  return kirimJson('/openrouter/generate-endpoint', muatan, opsi) as Promise<KonfigurasiEndpointTerbuat>;
}

// Backward-compatible English-shaped alias
export const openrouterGenerateEndpoint = hasilkanEndpointOpenRouter;
