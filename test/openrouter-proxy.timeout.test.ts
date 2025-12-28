const mod = await import('../scripts/openrouter-proxy.cjs');
const createApp = (mod as any).createApp || mod;

(async () => {
  console.log('🧪 [openrouter-proxy] Memastikan timeout dipicu dan ter-propagate');

  // Short timeout
  process.env.OPENROUTER_TIMEOUT_MS = '50';

  // Stub fetch that waits longer than timeout
  const originalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async () => {
    await new Promise((r) => setTimeout(r, 100));
    return { status: 200, json: async () => ({ choices: [{ message: { content: 'delayed' } }] }) };
  };

  const app = createApp({ openRouterApiKey: 'sk-test' });

  let threw = false;
  try {
    await app._isTest_callOpenRouter([{ role: 'user', content: 'hello' }]);
  } catch (e) {
    threw = true;
    if (!/timeout/.test(String(e))) throw new Error('Expected timeout error to include "timeout"');
  }

  (globalThis as any).fetch = originalFetch;
  delete process.env.OPENROUTER_TIMEOUT_MS;

  if (!threw) throw new Error('Expected callOpenRouter to throw on timeout');

  console.log('✅ PASS: openrouter timeout handled and surfaced');
})();
