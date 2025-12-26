const mod = await import('../scripts/openrouter-proxy.cjs');
const createApp = (mod as any).createApp || mod;

(async () => {
  console.log('🧪 [openrouter-proxy] Memastikan callOpenRouter melakukan retry pada error sementara');

  // Start a small server that will simulate transient 500 errors before returning 200
  let count = 0;
  const expressMod = await import('express');
  const fakeServer = expressMod.default();
  // Use built-in express JSON parser for simplicity
  fakeServer.use(expressMod.default.json());
  fakeServer.post('/api/v1/chat/completions', (req, res) => {
    count++;
    if (count < 3) return res.status(502).json({ error: 'bad_gateway' });
    return res.json({ choices: [{ message: { content: JSON.stringify({ hello: 'world' }) } }] });
  });
  const srv = fakeServer.listen(4004);

  // Monkeypatch global fetch to target our fake server
  (globalThis as any).fetch = async (url, opts) => {
    const nodeFetch = await import('node-fetch');
    const target = String(url).replace('https://openrouter.ai/api/v1/chat/completions', 'http://localhost:4004/api/v1/chat/completions');
    return nodeFetch.default(target, opts);
  };

  const app = createApp({ openRouterApiKey: 'abc' });
  const result = await app._isTest_callOpenRouter([{ role: 'user', content: 'hi' }]);
  // result should be successful after retries
  if (result.status !== 200) throw new Error('callOpenRouter harus berhasil setelah retry');

  srv.close();
  console.log('✅ PASS: openrouter call retried and succeeded');
})();
