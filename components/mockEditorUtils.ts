// MockEditorUtils.ts
/**
 * Utilitas untuk editor mock endpoint
 * Berisi fungsi-fungsi untuk konversi JSON ↔ skema visual, validasi, dan manipulasi struktur data
 */

/**
 * Interface untuk field dalam skema visual editor
 */
export interface SchemaField {
  id: string;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  children?: SchemaField[];
  isCollapsed?: boolean; // Untuk menyembunyikan/menampilkan children pada tipe object
  error?: string; // Pesan error validasi untuk field ini
}

/**
 * Fungsi default untuk menghasilkan ID unik
 * Menggunakan crypto.randomUUID jika tersedia, fallback ke random string
 */
const buatIdDefault = () =>
(typeof crypto !== "undefined" && crypto.randomUUID ?
  crypto.randomUUID() :
  `id_${Math.random().toString(36).slice(2, 9)}`
);

/**
 * Fungsi untuk deep clone objek
 * Menggunakan structuredClone jika tersedia, fallback ke JSON.parse/stringify
 * @param nilai - Nilai yang akan di-clone
 * @returns Clone dari nilai input
 */
export const klonDalam = <T>(nilai: T): T => {
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(nilai);
  }
  // Fallback untuk struktur yang dapat di-serialize ke JSON
  return JSON.parse(JSON.stringify(nilai));
};

/**
 * Parse nilai JSON (object atau array) menjadi pohon SchemaField
 * @param data - Data JSON yang akan di-parse
 * @param buatId - Fungsi untuk menghasilkan ID (default: buatIdDefault)
 * @returns Array SchemaField yang merepresentasikan struktur data
 */
export const parseJsonKeSkema = (
  data: unknown,
  buatId: () => string = buatIdDefault
): SchemaField[] => {
  // Hanya proses tipe object/array, abaikan tipe primitif
  if (typeof data !== "object" || data === null) return [];

  // Jika data adalah array, representasikan sebagai object dengan key numerik
  if (Array.isArray(data)) {
    return (data as any[]).map((nilai, indeks) => {
      const kunci = String(indeks);
      return buatFieldDariNilai(kunci, nilai, buatId);
    });
  }

  // Proses object biasa
  return Object.entries(data as Record<string, unknown>).map(
    ([kunci, nilai]) => buatFieldDariNilai(kunci, nilai, buatId)
  );
};

/**
 * Fungsi helper untuk membuat SchemaField dari nilai tertentu
 * @param kunci - Nama key untuk field
 * @param nilai - Nilai dari field
 * @param buatId - Fungsi untuk menghasilkan ID
 * @returns SchemaField yang sesuai dengan tipe nilai
 */
const buatFieldDariNilai = (
  kunci: string,
  nilai: unknown,
  buatId: () => string
): SchemaField => {
  const field: SchemaField = {
    id: buatId(),
    key: kunci,
    value: "",
    type: "string",
    children: [],
    isCollapsed: false,
  };

  // Tentukan tipe berdasarkan tipe JavaScript dari nilai
  if (nilai === null) {
    field.type = "null";
    field.value = "null";
  } else if (Array.isArray(nilai)) {
    field.type = "array";
    field.value = JSON.stringify(nilai);
  } else if (typeof nilai === "object") {
    field.type = "object";
    field.children = parseJsonKeSkema(nilai, buatId);
  } else if (typeof nilai === "number") {
    field.type = "number";
    field.value = String(nilai);
  } else if (typeof nilai === "boolean") {
    field.type = "boolean";
    field.value = String(nilai);
  } else {
    // Default: string
    field.type = "string";
    field.value = String(nilai as any);
  }

  return field;
};

/**
 * Error khusus untuk konversi skema ke JSON
 * Digunakan ketika ada data yang tidak valid dalam skema
 */
export class ErrorKonversiSkema extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "ErrorKonversiSkema";
  }
}

/**
 * Konversi array SchemaField menjadi struktur JSON
 * @param fields - Array SchemaField yang akan dikonversi
 * @param apakahRootArray - Apakah root adalah array? (default: false)
 * @returns Struktur JSON yang sesuai
 * @throws ErrorKonversiSkema - Jika ada field dengan tipe number/array yang tidak valid
 */
export const konversiSkemaKeJson = (
  fields: SchemaField[],
  apakahRootArray: boolean = false
): any => {
  const obj: Record<string, unknown> = {};

  for (const field of fields) {
    // Lewati field tanpa key (tidak valid)
    if (!field.key) continue;

    if (field.type === "object") {
      // Rekursif untuk children
      obj[field.key] = konversiSkemaKeJson(field.children || [], false);
    } else if (field.type === "number") {
      // Validasi number
      const angka = parseFloat(field.value);
      if (isNaN(angka)) {
        throw new ErrorKonversiSkema(`Angka tidak valid untuk kunci '${field.key}': ${field.value}`);
      }
      obj[field.key] = angka;
    } else if (field.type === "boolean") {
      // Konversi string boolean ke boolean
      obj[field.key] = field.value === "true";
    } else if (field.type === "array") {
      // Parse string JSON untuk array
      try {
        obj[field.key] = JSON.parse(field.value);
      } catch (error) {
        throw new ErrorKonversiSkema(
          `Array JSON tidak valid untuk kunci '${field.key}': ${(error as Error).message}`
        );
      }
    } else if (field.type === "null") {
      // Nilai null
      obj[field.key] = null;
    } else {
      // Default: string
      obj[field.key] = field.value;
    }
  }

  // Jika root adalah array, ubah object dengan kunci numerik menjadi array
  if (apakahRootArray) {
    // Kumpulkan pasangan kunci-nilai, filter hanya kunci numerik, urutkan berdasarkan indeks
    const pasangan = Object.entries(obj)
      .map(([kunci, nilai]) => ({
        kunci,
        indeks: Number(kunci),
        nilai
      }))
      .filter(pasangan => !Number.isNaN(pasangan.indeks))
      .sort((a, b) => a.indeks - b.indeks);

    // Kembalikan array dari nilai saja
    return pasangan.map(pasangan => pasangan.nilai);
  }

  return obj;
};

/**
 * Memindahkan field dalam pohon skema (atas/bawah)
 * @param fields - Array SchemaField sebagai pohon
 * @param id - ID field yang akan dipindahkan
 * @param arah - "up" (atas) atau "down" (bawah)
 * @returns Object dengan status pindah dan hasil pohon baru
 */
export const pindahkanFieldDiPohon = (
  fields: SchemaField[],
  id: string,
  arah: "up" | "down"
): { berhasilPindah: boolean; hasil: SchemaField[] } => {
  const hasilKlon = klonDalam(fields);
  let berhasilPindah = false;

  /**
   * Fungsi rekursif untuk mencari dan memindahkan field
   * @param daftar - Daftar field saat ini
   * @returns boolean - Apakah field ditemukan dan dipindahkan
   */
  const helper = (daftar: SchemaField[]): boolean => {
    const indeks = daftar.findIndex(field => field.id === id);

    if (indeks !== -1) {
      const indeksTukar = arah === "up" ? indeks - 1 : indeks + 1;

      // Pastikan indeks tukar dalam batas array
      if (indeksTukar >= 0 && indeksTukar < daftar.length) {
        // Tukar posisi
        [daftar[indeks], daftar[indeksTukar]] = [daftar[indeksTukar], daftar[indeks]];
        berhasilPindah = true;
      }
      return true;
    }

    // Cari di children secara rekursif
    for (const item of daftar) {
      if (item.children && helper(item.children)) return true;
    }

    return false;
  };

  helper(hasilKlon);
  return { berhasilPindah, hasil: hasilKlon };
};

/**
 * Validasi struktur JSON dan return error terstruktur dengan perkiraan baris error
 * @param stringJson - String JSON yang akan divalidasi
 * @returns Object error dengan message dan informasi posisi, atau null jika valid
 */
export const validasiStrukturJson = (
  stringJson: string
): { message: string; position?: number; line?: number } | null => {
  try {
    const terparse = JSON.parse(stringJson);

    // Untuk visual editor, root harus object atau array
    if (terparse === null) {
      return { message: "Root tidak boleh null untuk Visual Editor" };
    }

    if (typeof terparse !== "object") {
      return {
        message: "Elemen root harus berupa Object {} atau Array [] untuk Visual Editing"
      };
    }

    return null; // Valid
  } catch (error) {
    const pesan = (error as Error).message || "JSON tidak valid";
    const posisi = cariPosisiError(stringJson);
    const baris = posisi !== null ?
      stringJson.substring(0, posisi).split("\n").length :
      undefined;

    return {
      message: pesan,
      position: posisi ?? undefined,
      line: baris
    };
  }
};

/**
 * Mencari perkiraan posisi error dalam string JSON menggunakan binary search
 * @param stringJson - String JSON yang akan diperiksa
 * @returns Perkiraan posisi error, atau null jika tidak dapat ditentukan
 */
const cariPosisiError = (stringJson: string): number | null => {
  let rendah = 0;
  let tinggi = stringJson.length;
  let posisiTerakhirValid = -1;

  // Binary search untuk menemukan posisi error
  while (rendah <= tinggi) {
    const tengah = Math.floor((rendah + tinggi) / 2);

    try {
      // Coba parse substring
      JSON.parse(stringJson.substring(0, tengah));
      posisiTerakhirValid = tengah;
      rendah = tengah + 1;
    } catch (error) {
      tinggi = tengah - 1;
    }
  }

  if (posisiTerakhirValid === -1) return 0;

  // Return posisi setelah yang terakhir valid
  return Math.min(stringJson.length, posisiTerakhirValid + 1);
};

/**
 * Fungsi utilitas tambahan: Validasi field individual
 * @param field - Field yang akan divalidasi
 * @returns Object dengan status valid dan pesan error jika ada
 */
export const validasiField = (
  field: SchemaField
): { valid: boolean; pesanError?: string } => {
  if (field.type === "number") {
    const angka = parseFloat(field.value);
    if (isNaN(angka)) {
      return {
        valid: false,
        pesanError: `Nilai '${field.value}' bukan angka yang valid`
      };
    }
  } else if (field.type === "array") {
    try {
      JSON.parse(field.value);
    } catch (error) {
      return {
        valid: false,
        pesanError: `Format array tidak valid: ${(error as Error).message}`
      };
    }
  }

  return { valid: true };
};

/**
 * Fungsi untuk menemukan field berdasarkan ID dalam pohon skema
 * @param fields - Array SchemaField sebagai pohon
 * @param id - ID yang dicari
 * @returns Field yang ditemukan atau null jika tidak ditemukan
 */
export const temukanFieldDenganId = (
  fields: SchemaField[],
  id: string
): SchemaField | null => {
  for (const field of fields) {
    if (field.id === id) return field;

    if (field.children) {
      const ditemukanDiChildren = temukanFieldDenganId(field.children, id);
      if (ditemukanDiChildren) return ditemukanDiChildren;
    }
  }

  return null;
};

/**
 * Fungsi untuk menghitung total field dalam pohon skema
 * @param fields - Array SchemaField
 * @returns Jumlah total field termasuk semua children
 */
export const hitungTotalField = (fields: SchemaField[]): number => {
  let total = 0;

  for (const field of fields) {
    total++; // Field ini sendiri

    if (field.children) {
      total += hitungTotalField(field.children);
    }
  }

  return total;
};

/**
 * Fungsi untuk mem-flatten pohon skema menjadi array flat
 * @param fields - Array SchemaField sebagai pohon
 * @param includeChildren - Apakah menyertakan children? (default: true)
 * @returns Array flat dari semua field
 */
export const ratakanPohonSkema = (
  fields: SchemaField[],
  includeChildren: boolean = true
): SchemaField[] => {
  const hasil: SchemaField[] = [];

  for (const field of fields) {
    hasil.push(field);

    if (includeChildren && field.children) {
      hasil.push(...ratakanPohonSkema(field.children, true));
    }
  }

  return hasil;
};
