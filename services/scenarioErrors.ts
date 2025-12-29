// scenarioErrors.ts
// Definisi error khusus untuk layanan skenario

/**
 * Error dasar untuk semua error yang berkaitan dengan skenario
 */
export class ScenarioError extends Error {
  code: string;

  constructor(message: string, code = 'SCENARIO_ERROR') {
    super(message);
    this.name = 'ScenarioError';
    this.code = code;
  }
}

/**
 * Error ketika skenario tidak ditemukan
 */
export class ScenarioNotFoundError extends ScenarioError {
  constructor(id?: string) {
    super(`Skenario tidak ditemukan${id ? `: ${id}` : ''}`, 'SCENARIO_NOT_FOUND');
    this.name = 'ScenarioNotFoundError';
  }
}

/**
 * Error ketika sebuah step dalam skenario gagal dijalankan
 */
export class StepFailedError extends ScenarioError {
  stepId: string | number | undefined;
  original?: Error;

  constructor(stepId: string | number | undefined, message: string, original?: Error) {
    super(message || `Step gagal: ${String(stepId)}`, 'STEP_FAILED');
    this.name = 'StepFailedError';
    this.stepId = stepId;
    this.original = original;
  }
}

/**
 * Error ketika terjadi kesalahan dalam memproses template
 */
export class TemplateError extends ScenarioError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'TemplateError';
  }
}

// Alias untuk kompatibilitas mundur (Bahasa Indonesia)
export const ErrorSkenarioTidakDitemukan = ScenarioNotFoundError;
export const ErrorStepGagal = StepFailedError;
export const ErrorTemplate = TemplateError;
