export class UploadError extends Error {
  code: string;
  original?: Error;
  constructor(message: string, code = 'UPLOAD_ERROR', original?: Error) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.original = original;
  }
}

export class UploadFailedError extends UploadError {
  status?: number;
  body?: string;
  noRetry?: boolean;
  constructor(message: string, status?: number, body?: string, noRetry = false) {
    super(message, 'UPLOAD_FAILED');
    this.name = 'UploadFailedError';
    this.status = status;
    this.body = body;
    this.noRetry = noRetry;
  }
}

export class UploadTimeoutError extends UploadError {
  constructor(ms: number) {
    super(`Upload attempt timed out after ${ms}ms`, 'UPLOAD_TIMEOUT');
    this.name = 'UploadTimeoutError';
  }
}
