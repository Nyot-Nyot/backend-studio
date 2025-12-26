export interface OpenRouterMockResponse { json: string }
export interface GeneratedEndpointConfig { name: string; path: string; method: string; statusCode: number; responseBody: string }

const BASE = (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env.VITE_OPENROUTER_PROXY_URL) || '';

async function postJson(path: string, body: any, opts?: { clientKey?: string }) {
  const url = BASE ? `${BASE}${path}` : path;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Client key is only forwarded if explicitly provided via opts.clientKey (no implicit localStorage pickup)
  if (opts && opts.clientKey) {
    headers['X-OpenRouter-Key'] = opts.clientKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter proxy error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function openrouterGenerateMock(payload: { path: string; context?: string }, opts?: { clientKey?: string }): Promise<OpenRouterMockResponse> {
  return postJson('/openrouter/generate-mock', payload, opts);
}

export async function openrouterGenerateEndpoint(payload: { prompt: string }, opts?: { clientKey?: string }): Promise<GeneratedEndpointConfig> {
  return postJson('/openrouter/generate-endpoint', payload, opts);
}
