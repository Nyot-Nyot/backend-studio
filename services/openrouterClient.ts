export interface OpenRouterMockResponse { json: string }
export interface GeneratedEndpointConfig { name: string; path: string; method: string; statusCode: number; responseBody: string }

/**
 * Typed error returned when OpenRouter proxy responds with non-2xx
 */
export class OpenRouterError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message || `OpenRouter proxy error: ${status}`);
    this.name = 'OpenRouterError';
    this.status = status;
    this.body = body;
  }
}

function safeGetImportMetaEnvVar(name: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined') {
      return (import.meta as any).env && (import.meta as any).env[name];
    }
  } catch (e) {
    // import.meta may not be available in some runtimes — swallow and return undefined
  }
  return undefined;
}

// Determine BASE from env if present; normalize by trimming trailing slashes.
const RAW_BASE = safeGetImportMetaEnvVar('VITE_OPENROUTER_PROXY_URL');
const BASE = RAW_BASE && String(RAW_BASE).trim() !== '' ? String(RAW_BASE).replace(/\/+$/, '') : '';

async function postJson(path: string, body: unknown, opts?: { clientKey?: string }) {
  // ensure path starts with '/'
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = BASE ? `${BASE}${safePath}` : safePath;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Client key is only forwarded if explicitly provided via opts.clientKey (no implicit localStorage pickup)
  // This avoids accidentally reading secrets from storage.
  if (opts && typeof opts.clientKey === 'string' && opts.clientKey.length > 0) {
    headers['X-OpenRouter-Key'] = opts.clientKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // throw a typed error so callers can make structured decisions
    throw new OpenRouterError(res.status, text, `OpenRouter proxy error: ${res.status}`);
  }

  return res.json();
}

export async function openrouterGenerateMock(payload: { path: string; context?: string }, opts?: { clientKey?: string }): Promise<OpenRouterMockResponse> {
  return postJson('/openrouter/generate-mock', payload, opts) as Promise<OpenRouterMockResponse>;
}

export async function openrouterGenerateEndpoint(payload: { prompt: string }, opts?: { clientKey?: string }): Promise<GeneratedEndpointConfig> {
  return postJson('/openrouter/generate-endpoint', payload, opts) as Promise<GeneratedEndpointConfig>;
}
