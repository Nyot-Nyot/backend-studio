// utilsAutentikasi.ts
// Utilitas untuk menangani token autentikasi dan menampilkan pratinjau konfigurasi autentikasi

import { AuthConfig, TipeAutentikasi } from "../types";

/**
 * Mengekstrak tipe autentikasi dari konfigurasi dengan dukungan untuk properti lama dan baru
 * @param konfigurasi - Konfigurasi autentikasi yang mungkin memiliki properti 'jenis' atau 'type'
 * @returns Tipe autentikasi yang terdeteksi, default ke "NONE"
 */
const ekstrakTipeAutentikasi = (konfigurasi?: AuthConfig): TipeAutentikasi => {
  if (!konfigurasi) {
    return "NONE";
  }

  // Prioritaskan properti 'jenis' (Bahasa Indonesia), fallback ke 'type' (Inggris) untuk kompatibilitas
  const tipeDariJenis = (konfigurasi as any)?.jenis;
  const tipeDariType = (konfigurasi as any)?.type;

  return tipeDariJenis || tipeDariType || "NONE";
};

/**
 * Menyamarkan token sensitif untuk ditampilkan di antarmuka pengguna
 *
 * Fungsi ini memastikan token tidak pernah ditampilkan secara lengkap di UI
 * untuk alasan keamanan. Hanya beberapa karakter pertama dan terakhir yang ditampilkan.
 *
 * @param token - Token yang akan disamarkan (opsional)
 * @returns String token yang telah disamarkan
 *
 * @contohPenggunaan
 * ```
 * const tokenAsli = "abcdefghijklmnopqrstuvwxyz123456";
 * const tokenTersamarkan = samarkanToken(tokenAsli);
 * console.log(tokenTersamarkan); // "abcd...3456"
 * ```
 *
 * @catatanKeamanan
 * - Selalu samarkan token sebelum menampilkannya di UI
 * - Token dengan panjang <= 8 akan dikembalikan sebagai "***" untuk keamanan ekstra
 * - Token kosong atau undefined akan dikembalikan sebagai "***"
 */
export function samarkanToken(token?: string): string {
  // Token kosong atau tidak terdefinisi: kembalikan string aman
  if (!token || token.trim().length === 0) {
    return "***";
  }

  // Token terlalu pendek: jangan tampilkan sama sekali
  if (token.length <= 8) {
    return "***";
  }

  // Ambil 4 karakter pertama dan 4 karakter terakhir, sisipkan "..."
  const awalanToken = token.slice(0, 4);
  const akhiranToken = token.slice(-4);

  return `${awalanToken}...${akhiranToken}`;
}

/**
 * Memformat pratinjau konfigurasi autentikasi untuk ditampilkan di UI
 *
 * Fungsi ini mendukung dua format konfigurasi untuk kompatibilitas:
 * 1. Format baru dengan properti 'jenis' (Bahasa Indonesia)
 * 2. Format lama dengan properti 'type' (Bahasa Inggris)
 *
 * @param konfigurasiAutentikasi - Konfigurasi autentikasi (opsional)
 * @returns String yang mendeskripsikan konfigurasi autentikasi
 *
 * @contohPenggunaan
 * ```
 * const konfigBearer = { jenis: "BEARER_TOKEN", token: "eyJhbGciOiJIUzI1NiIs..." };
 * console.log(formatPratinjauAutentikasi(konfigBearer));
 * // "Authorization: Bearer eyJh...zI1Ni"
 *
 * const konfigApiKey = { jenis: "API_KEY", headerKey: "x-api-key", token: "12345" };
 * console.log(formatPratinjauAutentikasi(konfigApiKey));
 * // "x-api-key: ***" (token pendek disamarkan total)
 *
 * console.log(formatPratinjauAutentikasi());
 * // "Publik"
 * ```
 */
export function formatPratinjauAutentikasi(konfigurasiAutentikasi?: AuthConfig): string {
  const tipe = ekstrakTipeAutentikasi(konfigurasiAutentikasi);

  switch (tipe) {
    case "BEARER_TOKEN": {
      const token = (konfigurasiAutentikasi as any)?.token;
      const tokenTersamarkan = samarkanToken(token);
      return `Authorization: Bearer ${tokenTersamarkan}`;
    }

    case "API_KEY": {
      // Gunakan header default jika tidak disediakan
      const header = (konfigurasiAutentikasi as any)?.headerKey || "x-api-key";
      const token = (konfigurasiAutentikasi as any)?.token;
      const tokenTersamarkan = samarkanToken(token);
      return `${header}: ${tokenTersamarkan}`;
    }

    case "NONE":
    default:
      return "Publik";
  }
}

// Backward-compatible English alias used by some components
export const formatAuthPreview = formatPratinjauAutentikasi;
