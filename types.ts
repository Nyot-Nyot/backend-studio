
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export interface AuthConfig {
  type: 'NONE' | 'BEARER_TOKEN' | 'API_KEY';
  token?: string;      // The expected token/key value
  headerKey?: string;  // Custom header key for API_KEY type (e.g. 'x-api-key')
}

export interface ProxyConfig {
  enabled: boolean;
  target?: string; // full URL to forward requests to (e.g., https://api.example.com)
  timeout?: number; // in ms
  fallbackToMock?: boolean; // if true, fall back to local mock on proxy failure
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

export interface MockEndpoint {
  id: string;
  projectId: string; // Link to Project
  name: string;
  path: string;
  method: HttpMethod;
  statusCode: number;
  delay: number; // in ms
  responseBody: string; // JSON string
  isActive: boolean;
  version: string;
  createdAt: number;
  requestCount: number;
  headers: { key: string; value: string }[];
  storeName?: string; // NEW: If set, this endpoint interacts with a data bucket
  authConfig?: AuthConfig; // NEW: Built-in auth validation
  proxy?: ProxyConfig; // Optional per-route proxy passthrough configuration
}

export interface GeneratedEndpointConfig {
  name: string;
  path: string;
  method: HttpMethod | string;
  statusCode: number;
  responseBody: string; // stringified JSON
}

// Resource Schema types for schema-driven data generation
export interface ResourceField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  generator?: string; // e.g. 'uuid', 'randomName', 'email', 'number'
  nestedSchemaId?: string; // reference to another ResourceSchema for nested objects/arrays
}

export interface ResourceSchema {
  id: string;
  name: string; // e.g. 'users'
  fields: ResourceField[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  method: HttpMethod;
  path: string;
  statusCode: number;
  ip: string;
  duration: number;
}

export interface ResponseState {
  status: number;
  body: string;
  time: number;
  headers: { key: string; value: string }[];
  error?: string;
}

export interface TestConsoleState {
  method: HttpMethod;
  path: string;
  response: ResponseState | null;
  body?: string; // NEW: For POST/PUT requests in console
}

export type ViewState = 'dashboard' | 'editor' | 'logs' | 'settings' | 'test' | 'database';

// Scenario types
export interface CallApiPayload {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface EmitSocketPayload {
  event: string;
  data?: unknown;
}

export interface WaitPayload {
  duration: number; // in ms
}

export interface BaseScenarioStep {
  id: string;
  delay?: number;
}

export interface CallApiStep extends BaseScenarioStep {
  type: 'callApi';
  payload: CallApiPayload;
}

export interface EmitSocketStep extends BaseScenarioStep {
  type: 'emitSocket';
  payload: EmitSocketPayload;
}

export interface WaitStep extends BaseScenarioStep {
  type: 'wait';
  payload: WaitPayload;
}

export interface NoopStep extends BaseScenarioStep {
  type: 'noop';
  payload?: undefined;
}

export type ScenarioStep =
  | CallApiStep
  | EmitSocketStep
  | WaitStep
  | NoopStep;
export interface Scenario {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
  steps: ScenarioStep[];
}

export interface ScenarioStepLog<T = unknown> {
  stepId: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'success' | 'failed';
  /**
   * Output can be any serializable value produced by the step.
   * Use the generic parameter `T` to express a narrower type at the call site,
   * or leave as the default `unknown` and narrow where the value is consumed.
   */
  output?: T;
  error?: string;
}

export interface ScenarioRun<T = unknown> {
  id: string;
  scenarioId: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'completed' | 'failed';
  stepLogs: ScenarioStepLog<T>[];
}

export interface Connector<C extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  type: string;
  /** Connector configuration is connector-specific; use a generic to type it per-connector */
  config?: C;
  createdAt: number;
}

// --- Service Worker message contract ---
export enum SwMessageTypes {
  INTERCEPT_REQUEST = "INTERCEPT_REQUEST",
}

/** Payload dikirim dari Service Worker saat permintaan HTTP diintersep */
export interface SwInterceptRequestPayload {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SwInterceptMessage {
  type: SwMessageTypes;
  payload: SwInterceptRequestPayload;
}

