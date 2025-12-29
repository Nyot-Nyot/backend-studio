// uploadErrors.ts
// Definisi error khusus untuk layanan unggah file

/**
 * Error dasar untuk semua error yang berkaitan dengan proses unggah
 */
export class ErrorUnggah extends Error {
  code: string;
  original?: Error;

  constructor(message: string, code = 'UPLOAD_ERROR', original?: Error) {
    super(message);
    this.name = 'ErrorUnggah';
    this.code = code;
    this.original = original;
  }
}

/**
 * Error ketika proses unggah gagal
 */
export class ErrorUnggahGagal extends ErrorUnggah {
  status?: number;
  body?: string;
  janganUlang?: boolean;

  constructor(message: string, status?: number, body?: string, janganUlang = false) {
    super(message, 'UPLOAD_FAILED');
    this.name = 'ErrorUnggahGagal';
    this.status = status;
    this.body = body;
    this.janganUlang = janganUlang;
  }
}

/**
 * Error ketika proses unggah mengalami timeout
 */
export class ErrorTimeoutUnggah extends ErrorUnggah {
  constructor(ms: number) {
    super(`Upaya unggah mengalami timeout setelah ${ms}ms`, 'UPLOAD_TIMEOUT');
    this.name = 'ErrorTimeoutUnggah';
  }
}

// Alias untuk kompatibilitas mundur (Bahasa Inggris)
export const UploadError = ErrorUnggah;
export const UploadFailedError = ErrorUnggahGagal;
export const UploadTimeoutError = ErrorTimeoutUnggah;
