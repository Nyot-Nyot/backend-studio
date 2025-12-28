export class ZipError extends Error {
  code: string;
  constructor(message: string, code = 'ZIP_ERROR') {
    super(message);
    this.name = 'ZipError';
    this.code = code;
  }
}

export class ZipSizeError extends ZipError {
  constructor(message: string) {
    super(message, 'ZIP_SIZE_EXCEEDED');
    this.name = 'ZipSizeError';
  }
}

export class ZipGenerationError extends ZipError {
  constructor(message: string) {
    super(message, 'ZIP_GENERATION_ERROR');
    this.name = 'ZipGenerationError';
  }
}
