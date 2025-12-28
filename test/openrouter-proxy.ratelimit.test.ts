const mod = await import('../scripts/openrouter-proxy.cjs');
const createApp = (mod as any).createApp || mod;

(async () => {
  console.log('🧪 [openrouter-proxy] Memastikan rate-limit (429) ter-propagate dan tidak diretry');

  let calls = 0;
  // Stub fetch to return a 429 response with Retry-After header
  (globalThis as any).fetch = async () => {
    calls++;
    return {
      status: 429,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'retry-after' ? '120' : null),
      },
      json: async () => ({ message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day' }),
    };
  };

  const app = createApp({ openRouterApiKey: 'sk-test' });

  let threw = false;
  try {
    await app._isTest_callOpenRouter([{ role: 'user', content: 'hello' }]);
  } catch (e: any) {
    threw = true;
    if (!/rate_limit/.test(String(e))) throw new Error('Expected a rate_limit error');
    if (e.status !== 429) throw new Error('Error should have status 429');
    if (e.retryAfter !== '120') throw new Error('Expected retryAfter header to be present');
  }

  if (!threw) throw new Error('Expected callOpenRouter to throw on 429');
  if (calls !== 1) throw new Error('Should not retry on 429 (only one call expected)');

  console.log('✅ PASS: rate-limit is propagated and not retried');
})();
