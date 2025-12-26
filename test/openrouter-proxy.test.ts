import fetch from 'node-fetch';

let server: any;
let baseUrl = '';

async function startServerWithEnv(env: Record<string, string>) {
  // set requested env vars before importing module
  for (const k of Object.keys(env)) process.env[k] = env[k];
  // dynamic import to pick up env values
  const mod = await import('../scripts/openrouter-proxy.cjs');
  const appFactory = (mod as any).createApp || (mod as any).default || mod;
  const app = typeof appFactory === 'function' ? appFactory({ openRouterApiKey: env.OPENROUTER_API_KEY ?? null }) : appFactory;
  return new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise<void>(resolve => {
    server.close(() => resolve());
  });
}

let pass = 0;
let fail = 0;
const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      pass++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      fail++;
    }
  });
}

function assert(cond: boolean, msg = 'assert') {
  if (!cond) throw new Error(msg);
}

// Mock callOpenRouter network call by stubbing global fetch

const fakeSuccess = { choices: [{ message: { content: '{}' } }] };

test('401 when no server key and no client key', async () => {
  // Start server with no OPENROUTER_API_KEY and DEV_ALLOW_CLIENT_KEY unset
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.DEV_ALLOW_CLIENT_KEY;
  // pass explicit override to ensure factory treats openRouterApiKey as intentionally unset
  await startServerWithEnv({ OPENROUTER_API_KEY: null as any });

  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/x' }) });
  const body = await res.json().catch(() => ({}));
  console.log('status', res.status, 'body', body);
  assert(res.status === 401, 'expected 401 when no key available');
  await stopServer();
});

test('allow client header when DEV_ALLOW_CLIENT_KEY=1', async () => {
  process.env.DEV_ALLOW_CLIENT_KEY = '1';
  // stub fetch used by callOpenRouter
  (global as any).fetch = async () => ({ status: 200, json: async () => fakeSuccess });

  await startServerWithEnv({ DEV_ALLOW_CLIENT_KEY: '1' });
  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json', 'x-openrouter-key': 'abc' }, body: JSON.stringify({ path: '/x' }) });
  assert(res.status === 200, 'expected success when DEV_ALLOW_CLIENT_KEY=1 and header provided');
  await stopServer();
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
