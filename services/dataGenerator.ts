// generatorData.ts
// Layanan untuk menghasilkan data sintetis berdasarkan skema sumber daya dengan dukungan deterministik

import { ResourceField, ResourceSchema } from "../types";

/**
 * Contoh nama untuk generator data acak
 */
const contohNama = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];

/**
 * Fungsi hash FNV-1a sederhana untuk menghasilkan seed deterministik dari string
 * @param string - String input untuk di-hash
 * @returns Nilai hash 32-bit
 */
function fungsiHashXfnv1a(string: string): number {
  let hash = 2166136261 >>> 0;
  for (let indeks = 0; indeks < string.length; indeks++) {
    hash ^= string.charCodeAt(indeks) >>> 0;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Generator angka pseudorandom Mulberry32
 * @param seed - Seed untuk generator
 * @returns Fungsi yang mengembalikan angka acak antara 0 dan 1
 */
function pembangkitAngkaMulberry32(seed: number): () => number {
  return function () {
    let nilai = (seed += 0x6d2b79f5);
    nilai = Math.imul(nilai ^ (nilai >>> 15), nilai | 1);
    nilai ^= nilai + Math.imul(nilai ^ (nilai >>> 7), nilai | 61);
    return ((nilai ^ (nilai >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Interface untuk generator angka acak dengan fitur tambahan
 */
interface GeneratorAngkaAcak {
  random: () => number;
  randomInt: (min: number, max: number) => number;
  choice: <T>(array: T[]) => T;
}

/**
 * Membuat generator angka acak dengan dukungan seed untuk hasil deterministik
 * @param seed - Seed untuk generator (opsional, jika tidak ada akan menggunakan Math.random)
 * @returns Generator angka acak dengan metode utilitas
 */
function buatPembangkitAngkaAcak(seed?: string | number): GeneratorAngkaAcak {
  if (seed === undefined || seed === null) {
    return {
      random: () => Math.random(),
      randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      choice: <T,>(array: T[]) => array[Math.floor(Math.random() * array.length)],
    };
  }

  const seedNumerik = typeof seed === "number" ? seed : fungsiHashXfnv1a(String(seed));
  const fungsiRandom = pembangkitAngkaMulberry32(seedNumerik);

  return {
    random: fungsiRandom,
    randomInt: (min: number, max: number) => Math.floor(fungsiRandom() * (max - min + 1)) + min,
    choice: <T,>(array: T[]) => array[Math.floor(fungsiRandom() * array.length)],
  };
}

/**
 * Membuat UUID v4-like secara deterministik dari generator angka acak
 * @param generator - Generator angka acak
 * @returns UUID string
 */
function buatUuidDeterministik(generator: { random: () => number }): string {
  const hasilkanHex = (panjang: number): string => {
    let hasil = "";
    for (let indeks = 0; indeks < panjang; indeks++) {
      hasil += Math.floor(generator.random() * 16).toString(16);
    }
    return hasil;
  };

  return `${hasilkanHex(8)}-${hasilkanHex(4)}-4${hasilkanHex(3)}-${((Math.floor(generator.random() * 4) + 8).toString(16))}${hasilkanHex(3)}-${hasilkanHex(12)}`;
}

/**
 * Opsi untuk pembangkitan data
 */
export type OpsiPembangkitan = {
  seed?: string | number;
  schemaMap?: Record<string, ResourceSchema>;
  petaSchema?: Record<string, ResourceSchema>; // alias bahasa Indonesia
  maxDepth?: number;
  // penggunaan internal: memungkinkan penerusan generator yang ada atau kedalaman rekursi saat ini
  generator?: GeneratorAngkaAcak;
  depth?: number;
};

/**
 * Menghasilkan nilai untuk field tertentu berdasarkan tipe dan generatornya
 * @param field - Field yang akan diisi nilai
 * @param generator - Generator angka acak
 * @param petaSchema - Peta schema untuk referensi nested (opsional)
 * @param depth - Kedalaman rekursi saat ini (untuk mencegah infinite recursion)
 * @param maxDepth - Kedalaman maksimum yang diizinkan untuk nested object/array
 * @returns Nilai yang dihasilkan untuk field
 */
function hasilkanNilaiUntukField(
  field: ResourceField,
  generator: GeneratorAngkaAcak,
  petaSchema?: Record<string, ResourceSchema>,
  depth: number = 0,
  maxDepth: number = 3
): any {
  const generatorField = field.generator || "";

  switch (generatorField) {
    case "uuid":
      return generator.random === Math.random
        ? (crypto?.randomUUID ? crypto.randomUUID() : buatUuidDeterministik(generator))
        : buatUuidDeterministik(generator);
    case "randomName":
      return generator.choice(contohNama);
    case "email":
      return `${generator.choice(contohNama).toLowerCase()}${generator.randomInt(0, 999)}@example.com`;
    case "isoDate":
      // Tanggal deterministik yang diturunkan dari generator agar berjalan berulang dengan seed sama stabil
      // Epoch dasar: 2021-01-01 (1609459200000)
      return new Date(1609459200000 + Math.floor(generator.random() * 1000 * 60 * 60 * 24 * 365)).toISOString();
    case "number":
      return generator.randomInt(0, 1000);
    case "boolean":
      return generator.random() < 0.5;
    default:
      // Fallback: hasilkan nilai sederhana berdasarkan tipe
      switch ((field as any).tipe) {
        case "string":
          return `${(field as any).nama}_${generator.randomInt(0, 9999)}`;
        case "number":
          return generator.randomInt(0, 1000);
        case "boolean":
          return generator.random() < 0.5;
        case "date":
          return new Date().toISOString();
        case "object": {
          if (depth >= maxDepth) return {};
          const schemaBertumpuk = (field as any).nestedSchemaId && petaSchema ? petaSchema[(field as any).nestedSchemaId] : undefined;
          if (schemaBertumpuk) {
            return hasilkanRekaman(schemaBertumpuk, undefined, {
              generator,
              petaSchema,
              maxDepth,
              depth: depth + 1
            });
          }
          return {};
        }
        case "array": {
          if (depth >= maxDepth) return [];
          const schemaBertumpuk = (field as any).nestedSchemaId && petaSchema ? petaSchema[(field as any).nestedSchemaId] : undefined;
          const panjang = generator.randomInt(1, 3);

          if (schemaBertumpuk) {
            const array: any[] = [];
            for (let indeks = 0; indeks < panjang; indeks++) {
              array.push(hasilkanRekaman(schemaBertumpuk, undefined, {
                generator,
                petaSchema,
                maxDepth,
                depth: depth + 1
              }));
            }
            return array;
          }
          return [];
        }
        default:
          return null;
      }
  }
}

/**
 * Menghasilkan satu rekaman data berdasarkan schema
 * @param schema - Schema yang digunakan untuk pembangkitan data
 * @param petaField - Peta field (opsional)
 * @param opsi - Opsi pembangkitan data
 * @returns Objek rekaman dengan data yang dihasilkan
 */
export function hasilkanRekaman(
  schema: ResourceSchema,
  petaField?: Record<string, ResourceField>,
  opsi: OpsiPembangkitan = {}
): Record<string, any> {
  const keluaran: Record<string, any> = {};
  const generator = opsi.generator ?? buatPembangkitAngkaAcak(opsi.seed);
  const petaSchema = opsi.schemaMap ?? (opsi as any).petaSchema;
  const maxDepth = opsi.maxDepth ?? 3;
  const depth = opsi.depth ?? 0;

  for (const field of schema.fields) {
    keluaran[(field as any).nama] = hasilkanNilaiUntukField(field as any, generator, petaSchema, depth, maxDepth);
  }
  return keluaran;
}

/**
 * Menghasilkan banyak rekaman data berdasarkan schema
 * @param schema - Schema yang digunakan untuk pembangkitan data
 * @param jumlah - Jumlah rekaman yang akan dihasilkan (default: 1)
 * @param opsi - Opsi pembangkitan data
 * @returns Array rekaman dengan data yang dihasilkan
 *
 * @catatan
 * Jika seed disediakan, generator akan dibuat satu kali untuk seluruh batch
 * sehingga output stabil di semua proses berjalan
 */
export function hasilkanBanyakRekaman(
  schema: ResourceSchema,
  jumlah: number = 1,
  opsi: OpsiPembangkitan = {}
): any[] {
  const hasil: any[] = [];
  const generator = opsi.generator ?? buatPembangkitAngkaAcak(opsi.seed);

  for (let indeks = 0; indeks < jumlah; indeks++) {
    hasil.push(hasilkanRekaman(schema, undefined, { ...opsi, generator }));
  }
  return hasil;
}

/**
 * Pilihan generator yang tersedia untuk field
 */
export const PILIHAN_GENERATOR = ["uuid", "randomName", "email", "isoDate", "number", "boolean"];
