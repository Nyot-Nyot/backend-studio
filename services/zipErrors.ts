// zipErrors.ts
// Definisi error khusus untuk layanan pembuatan file ZIP

/**
 * Error dasar untuk semua error yang berkaitan dengan proses pembuatan ZIP
 */
export class ErrorZip extends Error {
  code: string;

  constructor(message: string, code = 'ZIP_ERROR') {
    super(message);
    this.name = 'ErrorZip';
    this.code = code;
  }
}

/**
 * Error ketika ukuran file melebihi batas yang diizinkan
 */
export class ErrorUkuranZip extends ErrorZip {
  constructor(message: string) {
    super(message, 'ZIP_SIZE_EXCEEDED');
    this.name = 'ErrorUkuranZip';
  }
}

/**
 * Error ketika gagal menghasilkan file ZIP
 */
export class ErrorGenerasiZip extends ErrorZip {
  constructor(message: string) {
    super(message, 'ZIP_GENERATION_ERROR');
    this.name = 'ErrorGenerasiZip';
  }
}

// Alias untuk kompatibilitas mundur (Bahasa Inggris)
export const ZipError = ErrorZip;
export const ZipSizeError = ErrorUkuranZip;
export const ZipGenerationError = ErrorGenerasiZip;
