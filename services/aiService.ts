// layananAI.ts
// Layanan untuk menghasilkan data tiruan dan konfigurasi endpoint menggunakan AI (OpenRouter)
import { FEATURES } from '../config/featureFlags';
import { GeneratedEndpointConfig } from '../types';
import { ErrorAI as AIError, KodeErrorAI } from './aiErrors';
import { OpenRouterError, openrouterGenerateEndpoint, openrouterGenerateMock } from './openrouterClient';

/**
 * Membungkus logika penanganan error dari OpenRouter untuk menghindari duplikasi kode
 * @param error - Error yang terjadi
 * @param kodeErrorDefault - Kode error default jika tidak termasuk kategori khusus
 * @param pesanErrorDefault - Pesan error default
 * @throws AIError dengan kode dan pesan yang sesuai
 */
const tanganiErrorOpenRouter = (
  error: unknown,
  kodeErrorDefault: KodeErrorAI,
  pesanErrorDefault: string
): never => {
  // Jika error sudah berupa AIError, lempar kembali tanpa perubahan
  if (error instanceof AIError) {
    throw error;
  }

  // Jika error berasal dari OpenRouter, periksa apakah timeout
  if (error instanceof OpenRouterError) {
    const isiError = String(error.body || '').toLowerCase();
    const adalahTimeout =
      error.status === 504 ||
      isiError.includes('proxy_timeout') ||
      isiError.includes('timeout');

    if (adalahTimeout) {
      throw new AIError(
        KodeErrorAI.OPENROUTER_TIMEOUT,
        'Permintaan ke OpenRouter mengalami timeout',
        { cause: error }
      );
    }
  }

  // Untuk error lain, lempar error default
  throw new AIError(kodeErrorDefault, pesanErrorDefault, { cause: error });
};

/**
 * Memeriksa apakah fitur AI diaktifkan, dengan opsi untuk mengabaikan pemeriksaan
 * @returns boolean - true jika AI diaktifkan, false jika tidak
 * @throws AIError jika AI tidak diaktifkan dan tidak ada pengabaian
 */
const periksaFiturAIAktif = (): boolean => {
  const fiturAIAktif = FEATURES.AI();
  const abaikanPemeriksaan = process.env.FORCE_ENABLE_AI === '1';

  return fiturAIAktif || abaikanPemeriksaan;
};

/**
 * Memvalidasi respons dari AI untuk data tiruan
 * @param respons - Respons dari AI
 * @returns boolean - true jika respons valid
 * @throws AIError jika respons tidak valid
 */
const getSnippet = (obj: unknown, max = 200) => {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return String(obj).slice(0, max);
  }
};

const validasiResponsDataTiruan = (respons: any): boolean => {
  const adaRespons = respons && typeof respons === 'object';
  const adaPropertiJson = adaRespons && 'json' in respons;
  const jsonIsString = adaPropertiJson && typeof respons.json === 'string';
  const jsonIsObject = adaPropertiJson && typeof respons.json === 'object';

  if (!adaRespons || !adaPropertiJson || (!jsonIsString && !jsonIsObject)) {
    const snippet = getSnippet(respons);
    const pesan = `Respons AI untuk data tiruan tidak valid: respons harus memiliki properti "json" bertipe string atau object. Received: ${snippet}`;
    console.debug('[AI] invalid mock response:', respons);
    throw new AIError(
      KodeErrorAI.INVALID_AI_RESPONSE,
      `${pesan}. Periksa proxy OpenRouter atau format respons dari layanan AI.`,
      { cause: { snippet } }
    );
  }

  return true;
};

/**
 * Memvalidasi respons dari AI untuk konfigurasi endpoint
 * @param respons - Respons dari AI
 * @returns boolean - true jika respons valid
 * @throws AIError jika respons tidak valid
 */
const validasiResponsKonfigurasiEndpoint = (respons: any): boolean => {
  const adaRespons = respons && typeof respons === 'object';
  const namaValid = adaRespons && 'name' in respons && typeof respons.name === 'string';
  const pathValid = adaRespons && 'path' in respons && typeof respons.path === 'string';

  if (!adaRespons || !namaValid || !pathValid) {
    const snippet = getSnippet(respons);
    const pesan = `Respons AI untuk konfigurasi endpoint tidak valid: respons harus memiliki properti "name" dan "path" bertipe string. Received: ${snippet}`;
    console.debug('[AI] invalid endpoint config response:', respons);
    throw new AIError(
      KodeErrorAI.INVALID_AI_CONFIG,
      `${pesan}. Periksa proxy OpenRouter, API key, atau format respons dari layanan AI.`,
      { cause: { snippet } }
    );
  }

  return true;
};

/**
 * Menghasilkan data tiruan (mock data) untuk endpoint tertentu menggunakan AI
 * @param path - Jalur endpoint yang akan dibuat data tiruannya
 * @param context - Konteks atau deskripsi tentang data apa yang diharapkan
 * @returns Promise<string> - Data tiruan dalam format string JSON
 *
 * @throws AIError dengan kode:
 *   - OPENROUTER_DISABLED jika fitur AI tidak diaktifkan
 *   - OPENROUTER_TIMEOUT jika permintaan timeout
 *   - INVALID_AI_RESPONSE jika respons AI tidak valid
 *
 * @contohPenggunaan
 * ```
 * const dataTiruan = await hasilkanDataTiruan(
 *   '/api/pengguna',
 *   'Data pengguna dengan nama, email, dan tanggal lahir'
 * );
 * console.log(dataTiruan); // '{"nama": "Budi", ...}'
 * ```
 */
export async function hasilkanDataTiruan(path: string, context: string): Promise<string> {
  // Periksa apakah layanan AI diaktifkan
  if (!periksaFiturAIAktif()) {
    throw new AIError(
      KodeErrorAI.OPENROUTER_DISABLED,
      'Penyedia OpenRouter dinonaktifkan. Aktifkan fitur AI atau setel FORCE_ENABLE_AI=1 untuk pengujian.'
    );
  }

  try {
    const respons = await openrouterGenerateMock({ path, context });

    // Validasi struktur respons dari AI (accept string OR object/array in respons.json)
    validasiResponsDataTiruan(respons);

    // Normalize respons.json to a string (if object/array, stringify it)
    let jsonStr: string;
    if (typeof respons.json === 'string') {
      jsonStr = respons.json;
    } else {
      try {
        jsonStr = JSON.stringify(respons.json);
      } catch (e) {
        console.debug('[AI] failed to stringify respons.json', respons.json);
        throw new AIError(
          KodeErrorAI.INVALID_AI_RESPONSE,
          'Respons AI mengandung properti "json" tapi tidak dapat diserialisasi menjadi string. Periksa format respons dari proxy/OpenRouter.'
        );
      }
    }

    // Return normalized JSON string
    return jsonStr;
  } catch (error) {
    // Tangani error dengan fungsi pembantu
    tanganiErrorOpenRouter(
      error,
      KodeErrorAI.INVALID_AI_RESPONSE,
      'Gagal menghasilkan data tiruan'
    );
  }
}

// Backward-compatible English aliases (used by some modules)
export const generateMockData = hasilkanDataTiruan;


/**
 * Menghasilkan konfigurasi endpoint berdasarkan deskripsi yang diberikan
 * @param prompt - Deskripsi atau petunjuk tentang endpoint yang ingin dibuat
 * @returns Promise<GeneratedEndpointConfig> - Konfigurasi endpoint yang dihasilkan oleh AI
 *
 * @throws AIError dengan kode:
 *   - OPENROUTER_DISABLED jika fitur AI tidak diaktifkan
 *   - OPENROUTER_TIMEOUT jika permintaan timeout
 *   - INVALID_AI_CONFIG jika respons AI tidak valid
 *
 * @contohPenggunaan
 * ```
 * const konfigurasi = await hasilkanKonfigurasiEndpoint(
 *   'Buat endpoint GET untuk mendapatkan daftar produk'
 * );
 * console.log(konfigurasi.name); // 'getProduk'
 * console.log(konfigurasi.path); // '/api/produk'
 * ```
 */
export async function hasilkanKonfigurasiEndpoint(prompt: string): Promise<GeneratedEndpointConfig> {
  // Periksa apakah layanan AI diaktifkan
  if (!periksaFiturAIAktif()) {
    throw new AIError(
      KodeErrorAI.OPENROUTER_DISABLED,
      'Penyedia OpenRouter dinonaktifkan. Aktifkan fitur AI atau setel FORCE_ENABLE_AI=1 untuk pengujian.'
    );
  }

  try {
    const respons = await openrouterGenerateEndpoint({ prompt });

    // Validasi struktur respons dari AI
    validasiResponsKonfigurasiEndpoint(respons);

    // Kembalikan respons yang sudah divalidasi sebagai GeneratedEndpointConfig
    return respons as GeneratedEndpointConfig;
  } catch (error) {
    // Tangani error dengan fungsi pembantu
    tanganiErrorOpenRouter(
      error,
      KodeErrorAI.INVALID_AI_CONFIG,
      'Gagal menghasilkan konfigurasi endpoint'
    );
  }
}

// Backward-compatible English alias
export const generateEndpointConfig = hasilkanKonfigurasiEndpoint;
