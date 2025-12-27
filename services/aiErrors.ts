export enum AIErrorCode {
  OPENROUTER_DISABLED = 'OPENROUTER_DISABLED',
  OPENROUTER_TIMEOUT = 'OPENROUTER_TIMEOUT',
  INVALID_AI_RESPONSE = 'INVALID_AI_RESPONSE',
  INVALID_AI_CONFIG = 'INVALID_AI_CONFIG',
}

export class AIError extends Error {
  code: AIErrorCode;
  constructor(code: AIErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message || code, options as any);
    this.name = 'AIError';
    this.code = code;
  }
}
