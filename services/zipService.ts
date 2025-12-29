// layananZip.ts
// Layanan untuk membuat file ZIP dari kumpulan file dengan validasi ukuran

import JSZip from "jszip";
import { ErrorGenerasiZip, ErrorUkuranZip } from './zipErrors';

/**
 * Opsi untuk pembuatan file ZIP
 */
export type OpsiBuatZip = {
  /** Ukuran maksimum per entri (dalam bytes) */
  maksUkuranPerEntri?: number;
  /** Ukuran total maksimum ZIP (dalam bytes) */
  maksUkuranTotal?: number;
  /** Tipe output yang dihasilkan */
  tipeOutput?: 'blob' | 'arraybuffer' | 'nodebuffer';
};

/**
 * Membuat file ZIP dari kumpulan file
 *
 * Fungsi ini melakukan dua tahap:
 * 1. Tahap pertama: Mengukur ukuran file secara konservatif untuk mencegah OOM
 * 2. Tahap kedua: Menambahkan file ke ZIP dan menghasilkan output
 *
 * @param file - Array objek file dengan nama dan blob
 * @param opsi - Opsi konfigurasi pembuatan ZIP
 * @returns Promise yang mengembalikan ZIP dalam tipe yang ditentukan
 * @throws ErrorUkuranZip jika ukuran file melebihi batas
 * @throws ErrorGenerasiZip jika gagal menambahkan file atau menghasilkan ZIP
 *
 * @contohPenggunaan
 * ```
 * const file = [
 *   { nama: 'laporan.pdf', blob: blobPdf },
 *   { nama: 'data.json', blob: blobJson }
 * ];
 *
 * const zip = await buatBlobZip(file, {
 *   maksUkuranPerEntri: 10 * 1024 * 1024, // 10MB
 *   maksUkuranTotal: 50 * 1024 * 1024,    // 50MB
 *   tipeOutput: 'blob'
 * });
 * ```
 */
export async function buatBlobZip(
  file: { nama: string; blob: Blob }[],
  opsi: OpsiBuatZip = {}
) {
  // Tentukan batas ukuran dengan nilai default jika tidak disediakan
  const batasPerEntri = typeof opsi.maksUkuranPerEntri === 'number'
    ? opsi.maksUkuranPerEntri
    : 20 * 1024 * 1024; // 20MB per entri default

  const batasTotal = typeof opsi.maksUkuranTotal === 'number'
    ? opsi.maksUkuranTotal
    : 200 * 1024 * 1024; // 200MB total default

  const zip = new JSZip();

  // Tahap pertama: Perkiraan ukuran secara konservatif tanpa memuat semua file jika memungkinkan
  let totalPerkiraan = 0;

  for (const fileSaatIni of file) {
    let ukuran: number | undefined = (fileSaatIni.blob as any)?.size;

    // Jika ukuran tidak tersedia, baca file untuk menentukannya
    if (typeof ukuran !== 'number') {
      try {
        const buffer = await (fileSaatIni.blob as any).arrayBuffer();
        ukuran = buffer.byteLength;
      } catch (errorPembacaan) {
        // Jika tidak dapat menentukan ukuran, tolak untuk menghindari OOM
        throw new ErrorUkuranZip(
          `Tidak dapat menentukan ukuran untuk file ${fileSaatIni.nama}`
        );
      }
    }

    // Validasi ukuran per entri
    if (ukuran > batasPerEntri) {
      throw new ErrorUkuranZip(
        `Entri ${fileSaatIni.nama} terlalu besar (${ukuran} bytes), ` +
        `batas adalah ${batasPerEntri} bytes`
      );
    }

    totalPerkiraan += ukuran;

    // Validasi ukuran total
    if (totalPerkiraan > batasTotal) {
      throw new ErrorUkuranZip(
        `Total perkiraan ukuran ZIP (${totalPerkiraan} bytes) ` +
        `melebihi batas (${batasTotal} bytes)`
      );
    }
  }

  // Tahap kedua: Tambahkan file ke ZIP (gunakan ArrayBuffer di Node.js atau jika diperlukan)
  for (const fileSaatIni of file) {
    try {
      if (typeof (fileSaatIni.blob as any).arrayBuffer === 'function') {
        const buffer = await (fileSaatIni.blob as any).arrayBuffer();
        zip.file(fileSaatIni.nama, buffer);
      } else {
        zip.file(fileSaatIni.nama, fileSaatIni.blob as any);
      }
    } catch (errorPenambahan: any) {
      throw new ErrorGenerasiZip(
        `Gagal menambahkan ${fileSaatIni.nama} ke ZIP: ` +
        `${errorPenambahan?.message || String(errorPenambahan)}`
      );
    }
  }

  // Hasilkan file ZIP
  try {
    const tipe = opsi.tipeOutput ?? 'blob';
    const hasil = await zip.generateAsync({ type: tipe });
    return hasil;
  } catch (errorGenerasi: any) {
    throw new ErrorGenerasiZip(
      `Gagal menghasilkan ZIP: ${errorGenerasi?.message || String(errorGenerasi)}`
    );
  }
}

// Backward-compatible English alias that accepts English-shaped file entries
export const createZipBlob = (
  files: { name?: string; nama?: string; blob: Blob }[],
  opsi?: OpsiBuatZip
) => {
  const normalized = files.map(f => ({ nama: (f as any).nama ?? (f as any).name, blob: f.blob }));
  return buatBlobZip(normalized as { nama: string; blob: Blob }[], opsi);
};

// Default export for convenience
export default { buatBlobZip, createZipBlob };
