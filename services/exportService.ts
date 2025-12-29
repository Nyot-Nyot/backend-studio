// layananEkspor.ts
// Layanan untuk menghasilkan kode server dari endpoint tiruan

import { MockEndpoint } from "../types";

/**
 * Interface untuk hasil render literal body
 */
interface HasilRenderLiteralBadan {
  literal: string;
  adalahJson: boolean;
}

/**
 * Merender literal JavaScript yang aman untuk penyematan dalam kode server yang dihasilkan.
 *
 * @param stringBadan - String body respons
 * @returns Objek berisi literal yang sudah dirender dan informasi apakah JSON
 *
 * @logika
 * 1. Jika stringBadan adalah JSON valid (objek/array/primitif), kembalikan literal JSON yang diformat
 * 2. Jika bukan JSON, kembalikan literal string JavaScript yang aman
 * 3. Untuk body kosong, kembalikan objek kosong {}
 *
 * @contohPenggunaan
 * ```
 * const { literal, adalahJson } = renderLiteralBadan('{"nama": "Budi"}');
 * // literal: '{\n  "nama": "Budi"\n}', adalahJson: true
 *
 * const { literal, adalahJson } = renderLiteralBadan('Halo dunia');
 * // literal: '"Halo dunia"', adalahJson: false
 * ```
 */
export const renderLiteralBadan = (stringBadan: string): HasilRenderLiteralBadan => {
  const stringAsli = String(stringBadan ?? "");
  const stringDipangkas = stringAsli.trim();

  // Heuristik cepat: objek/array JSON atau primitif JSON
  if (!stringDipangkas) {
    return { literal: "{}", adalahJson: true };
  }

  try {
    const parsed = JSON.parse(stringAsli);
    // Render JSON dengan indentasi 2 spasi
    return {
      literal: JSON.stringify(parsed, null, 2),
      adalahJson: true
    };
  } catch (errorParsing) {
    // Bukan JSON valid — kembalikan literal string JavaScript yang aman
    return {
      literal: JSON.stringify(stringAsli),
      adalahJson: false
    };
  }
};

/**
 * Membuat komentar yang aman dengan menghindari penutup komentar yang tidak diinginkan
 * @param teks - Teks untuk dijadikan komentar
 * @returns String yang aman untuk digunakan dalam komentar
 *
 * @catatanKeamanan
 * Fungsi ini mengganti urutan '* /' (dipisah) untuk mencegah penutupan komentar prematur
 * yang bisa menyebabkan injeksi kode.
 */
function buatKomentarAman(teks: string): string {
  return String(teks).replace(/\*\//g, "* /");
}

/**
 * Membuat literal jalur yang aman untuk kode JavaScript
 * @param jalur - Jalur endpoint
 * @returns String literal JavaScript yang aman
 *
 * @contohPenggunaan
 * ```
 * const literal = buatLiteralJalurAman('/api/users');
 * // Hasil: '"/api/users"'
 * ```
 */
function buatLiteralJalurAman(jalur: string): string {
  // Gunakan JSON.stringify untuk menghasilkan literal string JavaScript yang aman
  // termasuk pelolosan yang tepat
  return JSON.stringify(jalur || "");
}

/**
 * Mendapatkan nilai timeout dari opsi atau environment variable
 * @param opsi - Opsi opsional yang mungkin berisi timeoutMs
 * @returns Nilai timeout dalam milidetik
 */
const dapatkanNilaiTimeout = (opsi?: { timeoutMs?: number }): number => {
  const DEFAULT_TIMEOUT_MS = 30_000;

  // Prioritaskan nilai dari opsi eksplisit
  if (typeof opsi?.timeoutMs === 'number') {
    return opsi.timeoutMs;
  }

  // Coba dari environment variable
  if (process.env.SERVER_TIMEOUT_MS) {
    const nilaiNumerik = Number(process.env.SERVER_TIMEOUT_MS);
    if (!Number.isNaN(nilaiNumerik) && nilaiNumerik > 0) {
      return nilaiNumerik;
    }
  }

  // Gunakan default
  return DEFAULT_TIMEOUT_MS;
};

/**
 * Mendapatkan nilai CORS origin dari opsi atau environment variable
 * @param opsi - Opsi opsional yang mungkin berisi corsOrigin
 * @returns Nilai origin untuk CORS
 */
const dapatkanCorsOrigin = (opsi?: { corsOrigin?: string }): string => {
  // Prioritaskan nilai dari opsi eksplisit
  if (opsi?.corsOrigin) {
    return opsi.corsOrigin;
  }

  // Coba dari environment variable
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN;
  }

  // Default ke wildcard (perhatikan bahwa ini tidak aman untuk produksi)
  return "*";
};

/**
 * Membuat kode handler untuk endpoint tunggal
 * @param endpoint - Konfigurasi endpoint tiruan
 * @returns String kode JavaScript untuk handler
 */
const buatKodeHandlerEndpoint = (endpoint: MockEndpoint): string => {
  const { literal: literalBadan, adalahJson } = renderLiteralBadan(endpoint.responseBody || "");
  const literalJalur = buatLiteralJalurAman(endpoint.path);
  const komentar = buatKomentarAman(endpoint.nama || "");
  const method = String(endpoint.metode).toLowerCase();
  const statusCode = endpoint.statusCode;

  if (adalahJson) {
    return `app.${method}(${literalJalur}, async (req, res) => {
  // Handler for ${komentar}
  const status = ${statusCode};
  const body = ${literalBadan};
  // Simple per-route logging before sending response
  console.log(req.method, req.path, status);
  res.status(status).json(body);
});`;
  }

  // Respons teks biasa — kirim sebagai teks untuk menghindari kejutan bagi konsumen JSON
  return `app.${method}(${literalJalur}, async (req, res) => {
  // Handler for ${komentar}
  const status = ${statusCode};
  const body = ${literalBadan};
  // Simple per-route logging before sending response
  console.log(req.method, req.path, status);
  res.status(status).type('text/plain').send(body);
});`;
};

/**
 * Menghasilkan kode server Express dari endpoint tiruan yang aktif
 * @param endpointTiruanAktif - Array endpoint tiruan yang aktif
 * @param opsi - Opsi opsional untuk konfigurasi server
 * @returns String kode JavaScript untuk server Express
 *
 * @contohPenggunaan
 * ```
 * const kodeServer = hasilkanKodeServer(endpointTiruanAktif, {
 *   corsOrigin: 'http://localhost:3000',
 *   timeoutMs: 15000
 * });
 * ```
 *
 * @catatanFitur
 * - Menghasilkan server Express dengan CORS yang dapat dikonfigurasi
 * - Menambahkan logging sederhana untuk setiap permintaan
 * - Mengatur timeout server untuk mencegah permintaan yang berjalan terlalu lama
 * - Menghasilkan handler dengan tipe respons yang tepat (JSON atau teks biasa)
 */
export const hasilkanKodeServer = (
  endpointTiruanAktif: MockEndpoint[],
  opsi?: { corsOrigin?: string; timeoutMs?: number }
): string => {
  const corsOrigin = dapatkanCorsOrigin(opsi);
  const timeoutMs = dapatkanNilaiTimeout(opsi);

  // Hasilkan kode untuk setiap rute
  const kodeRute = endpointTiruanAktif
    .map(buatKodeHandlerEndpoint)
    .join("\n\n");

  // Template kode server Express
  return `const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Middleware
app.use(cors({ origin: ${JSON.stringify(corsOrigin)} }));
app.use(express.json());

// Simple logger that logs method, path and final status after response finishes
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(req.method, req.originalUrl, res.statusCode);
  });
  next();
});

// Routes
${kodeRute}

const server = app.listen(PORT, () => {
  // If PORT was 0 (ephemeral), server.address() contains the real port
  const addr = server.address();
  const actualPort = (addr && typeof addr === 'object' && 'port' in addr) ? addr.port : PORT;
  console.log('Server running on port ' + actualPort);
});

// Set a server timeout to guard long-running requests (ms)
server.setTimeout(${Number(timeoutMs)});
`;
};

// Backward-compatible English alias
export const generateServerCode = hasilkanKodeServer;
