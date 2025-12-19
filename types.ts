
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

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: 'queued' | 'sending' | 'delivered' | 'failed';
  trace: string[];
  createdAt: number;
  updatedAt?: number;
}
export type ViewState = 'dashboard' | 'editor' | 'logs' | 'settings' | 'test' | 'database' | 'externalApi' | 'email' | 'socket';
