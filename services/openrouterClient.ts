export interface OpenRouterMockResponse { json: string }
export interface GeneratedEndpointConfig { name: string; path: string; method: string; statusCode: number; responseBody: string }

const BASE = (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env.VITE_OPENROUTER_PROXY_URL) || '';

async function postJson(path: string, body: any) {
  const url = BASE ? `${BASE}${path}` : path;
  // Allow a dev-time localStorage key to be forwarded as X-OpenRouter-Key for convenience
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const storedKey = typeof window !== 'undefined' ? window.localStorage?.getItem('api_sim_user_openrouter_key') : null;
    if (storedKey) headers['X-OpenRouter-Key'] = storedKey;
  } catch (e) {
    // ignore
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

export async function openrouterGenerateMock(payload: { path: string; context?: string }): Promise<OpenRouterMockResponse> {
  return postJson('/openrouter/generate-mock', payload);
}

export async function openrouterGenerateEndpoint(payload: { prompt: string }): Promise<GeneratedEndpointConfig> {
  return postJson('/openrouter/generate-endpoint', payload);
}
