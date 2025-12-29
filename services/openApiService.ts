// layananOpenApi.ts
// Layanan untuk menghasilkan spesifikasi OpenAPI dari endpoint tiruan

import { MockEndpoint, Project } from "../types";

/**
 * Mengonversi jalur internal "/users/:id" ke jalur OpenAPI "/users/{id}"
 * @param jalur - Jalur dengan parameter dinamis (misalnya ":id")
 * @returns Jalur dalam format OpenAPI
 *
 * @contoh
 * ```
 * const hasil = konversiJalurKeOpenApi('/users/:id/posts/:postId');
 * // Hasil: '/users/{id}/posts/{postId}'
 * ```
 */
const konversiJalurKeOpenApi = (jalur: string): string => {
  return jalur.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
};

/**
 * Mengekstrak parameter dari jalur
 * @param jalur - Jalur dengan parameter dinamis
 * @returns Array parameter untuk OpenAPI
 *
 * @contoh
 * ```
 * const parameter = ekstrakParameterJalur('/users/:id/posts/:postId');
 * // Hasil: [
 * //   { name: 'id', in: 'path', required: true, ... },
 * //   { name: 'postId', in: 'path', required: true, ... }
 * // ]
 * ```
 */
const ekstrakParameterJalur = (jalur: string): any[] => {
  const kecocokan = jalur.match(/:([a-zA-Z0-9_]+)/g);
  if (!kecocokan) return [];

  return kecocokan.map((parameter) => ({
    name: parameter.substring(1),
    in: "path",
    required: true,
    schema: { type: "string" },
    description: `Parameter ${parameter.substring(1)}`,
  }));
};

/**
 * Menduga skema JSON dari nilai (Rekursif)
 * @param data - Data untuk dianalisis
 * @returns Skema JSON untuk OpenAPI
 *
 * @logika
 * 1. Untuk null: tipe string dengan nullable: true
 * 2. Untuk array: tipe array dengan items berdasarkan elemen pertama
 * 3. Untuk objek: tipe object dengan properties dan required
 * 4. Untuk number: periksa apakah integer atau number
 * 5. Untuk boolean: tipe boolean
 * 6. Default: tipe string dengan contoh nilai
 */
const dugaSkema = (data: any): any => {
  if (data === null) return { type: "string", nullable: true };

  const tipe = typeof data;

  if (Array.isArray(data)) {
    const skemaItem = data.length > 0 ? dugaSkema(data[0]) : { type: "object" };
    return {
      type: "array",
      items: skemaItem,
    };
  }

  if (tipe === "object") {
    const properties: any = {};
    const required: string[] = [];

    Object.keys(data).forEach((kunci) => {
      properties[kunci] = dugaSkema(data[kunci]);
      required.push(kunci);
    });

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (tipe === "number") {
    return { type: Number.isInteger(data) ? "integer" : "number" };
  }

  if (tipe === "boolean") {
    return { type: "boolean" };
  }

  // Default ke string (menangani variabel dinamis seperti {{$uuid}})
  return { type: "string", example: data };
};

/**
 * Mendapatkan deskripsi yang mudah dibaca manusia untuk kode status HTTP
 * @param kodeStatus - Kode status HTTP
 * @param method - Metode HTTP
 * @returns Deskripsi kode status
 */
const dapatkanDeskripsiStatus = (kodeStatus: number, method: string): string => {
  const deskripsi: Record<number, string> = {
    200: "OK - Permintaan berhasil",
    201: "Created - Sumber daya berhasil dibuat",
    204: "No Content - Permintaan berhasil, tidak ada konten untuk dikembalikan",
    400: "Bad Request - Permintaan tidak valid",
    401: "Unauthorized - Diperlukan autentikasi",
    403: "Forbidden - Akses ditolak",
    404: "Not Found - Sumber daya tidak ditemukan",
    500: "Internal Server Error",
  };

  return deskripsi[kodeStatus] || `Respons dengan status ${kodeStatus}`;
};

/**
 * Mengekstrak tag dari jalur (misalnya /users/:id -> users)
 * @param jalur - Jalur endpoint
 * @returns Tag untuk pengelompokan di OpenAPI
 */
const ekstrakTagDariJalur = (jalur: string): string => {
  const bagian = jalur.split("/").filter(Boolean);
  return bagian.length > 0 ? bagian[0] : "default";
};

/**
 * Membuat spesifikasi OpenAPI dari proyek dan endpoint tiruan
 * @param proyek - Proyek yang berisi informasi umum
 * @param mock - Daftar endpoint tiruan
 * @returns Objek spesifikasi OpenAPI
 *
 * @contohPenggunaan
 * ```
 * const spesifikasi = hasilkanSpesifikasiOpenApi(proyekSaya, daftarMock);
 * console.log(spesifikasi.info.title); // "API Proyek Saya"
 * ```
 *
 * @catatan
 * - Hanya endpoint aktif dalam proyek yang akan disertakan
 * - Skema respons diduga dari responseBody
 * - Parameter jalur otomatis diekstrak
 * - Tag dihasilkan dari segmen pertama jalur
 */
export const hasilkanSpesifikasiOpenApi = (
  proyek: Project,
  mock: MockEndpoint[]
) => {
  // Filter hanya mock yang aktif dan milik proyek ini
  const mockAktif = mock.filter(
    (m) => m.isActive && m.projectId === proyek.id
  );

  const paths: Record<string, any> = {};

  mockAktif.forEach((mockEndpoint) => {
    const jalurOpenApi = konversiJalurKeOpenApi(mockEndpoint.path);

    if (!paths[jalurOpenApi]) {
      paths[jalurOpenApi] = {};
    }

    const parameterJalur = ekstrakParameterJalur(mockEndpoint.path);

    let skemaRespons = { type: "object" };
    let contohRespons = null;

    try {
      contohRespons = JSON.parse(mockEndpoint.responseBody);
      skemaRespons = dugaSkema(contohRespons);
    } catch (errorParsing) {
      // Jika badan respons bukan JSON valid, perlakukan sebagai teks biasa/string
      skemaRespons = { type: "string" };
      contohRespons = mockEndpoint.responseBody;
    }

    // Bangun objek operasi
    const operasi: Record<string, any> = {
      summary: mockEndpoint.nama,
      description: `Endpoint ${String(mockEndpoint.metode)} ${mockEndpoint.path}`,
      tags: [ekstrakTagDariJalur(mockEndpoint.path)],
    };

    // Tambahkan parameter jika ada
    if (parameterJalur.length > 0) {
      operasi.parameters = parameterJalur;
    }

    // Tambahkan request body untuk POST/PUT/PATCH
    if (["POST", "PUT", "PATCH"].includes(String(mockEndpoint.metode).toUpperCase())) {
      // Coba duga skema permintaan dari respons, atau gunakan objek generik
      let skemaPermintaan = {
        type: "object",
        properties: { data: { type: "object" } },
      };
      let contohPermintaan = { data: {} };

      try {
        const terparse = JSON.parse(mockEndpoint.responseBody);
        if (typeof terparse === "object" && !Array.isArray(terparse)) {
          skemaPermintaan = dugaSkema(terparse);
          contohPermintaan = terparse;
        }
      } catch (errorParsing) {
        // Tetap gunakan default
      }

      operasi.requestBody = {
        required: true,
        description: `Badan permintaan untuk ${String(mockEndpoint.metode).toLowerCase()} ${mockEndpoint.path}`,
        content: {
          "application/json": {
            schema: skemaPermintaan,
            example: contohPermintaan,
          },
        },
      };
    }

    // Tambahkan respons
    operasi.responses = {
      [mockEndpoint.statusCode]: {
        description: dapatkanDeskripsiStatus(mockEndpoint.statusCode, String(mockEndpoint.metode)),
        content: {
          "application/json": {
            schema: skemaRespons,
            ...(contohRespons && { example: contohRespons }),
          },
        },
      },
    };

    paths[jalurOpenApi][String(mockEndpoint.metode).toLowerCase()] = operasi;
  });

  // Kembalikan spesifikasi OpenAPI lengkap
  return {
    openapi: "3.0.0",
    info: {
      title: proyek.nama || "API",
      description: "Dihasilkan oleh Backend Studio",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Server Pengembangan Lokal",
      },
    ],
    paths: paths,
    components: {
      schemas: {},
    },
  };
};

// Backward-compatible English alias
export const generateOpenApiSpec = hasilkanSpesifikasiOpenApi;
