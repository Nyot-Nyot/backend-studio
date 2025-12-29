// aiErrors.ts
// Definisi error khusus untuk layanan AI

/**
 * Kode error untuk berbagai jenis kesalahan yang dapat terjadi pada layanan AI
 *
 * @enum KodeErrorAI
 * @property OPENROUTER_DISABLED - Fitur OpenRouter dinonaktifkan
 * @property OPENROUTER_TIMEOUT - Permintaan ke OpenRouter mengalami timeout
 * @property INVALID_AI_RESPONSE - Respons dari AI tidak valid
 * @property INVALID_AI_CONFIG - Konfigurasi yang dihasilkan AI tidak valid
 */
export enum KodeErrorAI {
  OPENROUTER_DISABLED = 'OPENROUTER_DISABLED',
  OPENROUTER_TIMEOUT = 'OPENROUTER_TIMEOUT',
  INVALID_AI_RESPONSE = 'INVALID_AI_RESPONSE',
  INVALID_AI_CONFIG = 'INVALID_AI_CONFIG',
}

/**
 * Class error khusus untuk kesalahan yang berkaitan dengan layanan AI
 *
 * @class ErrorAI
 * @extends Error
 * @property {KodeErrorAI} code - Kode error yang lebih spesifik
 *
 * @contohPenggunaan
 * ```
 * throw new ErrorAI(KodeErrorAI.OPENROUTER_TIMEOUT, 'Permintaan ke OpenRouter mengalami timeout');
 * ```
 */
export class ErrorAI extends Error {
  code: KodeErrorAI;

  constructor(
    code: KodeErrorAI,
    message?: string,
    options?: { cause?: unknown }
  ) {
    super(message || code, options as any);
    this.name = 'ErrorAI';
    this.code = code;
  }
}

// Backward-compatible English-shaped aliases
export const AIError = ErrorAI;
export const AIErrorCode = KodeErrorAI;
