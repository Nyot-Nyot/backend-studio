// validasi.ts
// Layanan untuk memvalidasi data impor workspace

/**
 * Memvalidasi struktur data impor workspace
 *
 * Fungsi ini memastikan bahwa data yang diimpor memiliki format yang benar
 * sebelum diproses lebih lanjut. Validasi mencakup:
 * 1. Keberadaan properti utama (projects, mocks)
 * 2. Tipe data yang sesuai untuk setiap properti
 * 3. Properti wajib pada setiap item
 *
 * @param data - Data yang akan divalidasi (biasanya dari file JSON impor)
 * @returns boolean - true jika data valid
 * @throws Error dengan pesan spesifik jika validasi gagal
 *
 * @contohPenggunaan
 * ```
 * try {
 *   validasiImporWorkspace(dataJson);
 *   console.log('Data valid, dapat diproses');
 * } catch (error) {
 *   console.error('Data tidak valid:', error.message);
 * }
 * ```
 *
 * @strukturDataYangDiharapkan
 * ```
 * {
 *   projects: Array<{ id: string, name: string, ... }>,
 *   mocks: Array<{ id: string, path: string, method: string, ... }>
 * }
 * ```
 */
export function validasiImporWorkspace(data: any): boolean {
  // Validasi 1: Data harus berupa objek non-null
  if (!data || typeof data !== 'object') {
    throw new Error('Format file tidak valid: data harus berupa objek');
  }

  // Validasi 2: Properti 'projects' harus ada dan berupa array
  if (!Array.isArray(data.projects)) {
    throw new Error('Format file tidak valid: properti "projects" harus berupa array');
  }

  // Validasi 3: Properti 'mocks' harus ada dan berupa array
  if (!Array.isArray(data.mocks)) {
    throw new Error('Format file tidak valid: properti "mocks" harus berupa array');
  }

  // Validasi 4: Setiap proyek dalam array harus memiliki bentuk dasar yang valid
  data.projects.forEach((proyek: any, indeks: number) => {
    // Proyek harus berupa objek non-null
    if (!proyek || typeof proyek !== 'object') {
      throw new Error(`Proyek pada indeks ${indeks} tidak valid: harus berupa objek`);
    }

    // Proyek harus memiliki properti 'id' dan 'name'
    if (!proyek.id || !proyek.name) {
      throw new Error(
        `Proyek pada indeks ${indeks} tidak valid: ` +
        `properti "id" dan "name" wajib ada`
      );
    }
  });

  // Validasi 5: Setiap mock endpoint dalam array harus memiliki bentuk dasar yang valid
  data.mocks.forEach((mock: any, indeks: number) => {
    // Mock harus berupa objek non-null
    if (!mock || typeof mock !== 'object') {
      throw new Error(`Mock endpoint pada indeks ${indeks} tidak valid: harus berupa objek`);
    }

    // Mock harus memiliki properti 'id', 'path', dan 'method'
    const propertiWajib = ['id', 'path', 'method'];
    const propertiYangHilang = propertiWajib.filter(properti => !mock[properti]);

    if (propertiYangHilang.length > 0) {
      throw new Error(
        `Mock endpoint pada indeks ${indeks} tidak valid: ` +
        `properti "${propertiYangHilang.join(', ')}" wajib ada`
      );
    }
  });

  // Jika semua validasi berhasil, kembalikan true
  return true;
}

// Backward-compatible English alias
export const validateWorkspaceImport = validasiImporWorkspace;

// Default export
export default { validasiImporWorkspace, validateWorkspaceImport };
