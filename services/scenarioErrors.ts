export class ScenarioError extends Error {
  code: string;
  constructor(message: string, code = 'SCENARIO_ERROR') {
    super(message);
    this.name = 'ScenarioError';
    this.code = code;
  }
}

export class ScenarioNotFoundError extends ScenarioError {
  constructor(id?: string) {
    super(`Scenario not found${id ? `: ${id}` : ''}`, 'SCENARIO_NOT_FOUND');
    this.name = 'ScenarioNotFoundError';
  }
}

export class StepFailedError extends ScenarioError {
  stepId: string | number | undefined;
  original?: Error;
  constructor(stepId: string | number | undefined, message: string, original?: Error) {
    super(message || `Step failed: ${String(stepId)}`, 'STEP_FAILED');
    this.name = 'StepFailedError';
    this.stepId = stepId;
    this.original = original;
  }
}

export class TemplateError extends ScenarioError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'TemplateError';
  }
}
