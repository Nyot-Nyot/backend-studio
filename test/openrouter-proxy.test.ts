import fetch from 'node-fetch';

let server: any;
let baseUrl = '';

async function startServerWithEnv(env: Record<string, string | null | undefined>) {
  // set or clear requested env vars before importing module
  for (const k of Object.keys(env)) {
    const v = (env as any)[k];
    if (v === null || typeof v === 'undefined') delete process.env[k];
    else process.env[k] = String(v);
  }
  // dynamic import to pick up env values
  const mod = await import('../scripts/openrouter-proxy.cjs');
  const appFactory = (mod as any).createApp || (mod as any).default || mod;
  const app = typeof appFactory === 'function' ? appFactory({ openRouterApiKey: env.OPENROUTER_API_KEY ?? undefined }) : appFactory;
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
  // Ensure environment flags cleared
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.DEV_ALLOW_CLIENT_KEY;
  delete process.env.NODE_ENV;

  // Create app with a callOpenRouter stub that would throw if invoked (we expect it NOT to be called)
  const mod = await import('../scripts/openrouter-proxy.cjs');
  const appFactory = (mod as any).createApp || (mod as any).default || mod;
  const app = appFactory({ quiet: true, openRouterApiKey: null, callOpenRouter: async () => { throw new Error('callOpenRouter should not be invoked when no key'); } });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/x' }) });
  assert(res.status === 401, 'expected 401 when no key available');
  await stopServer();
});

test('allow client header when DEV_ALLOW_CLIENT_KEY=1', async () => {
  process.env.DEV_ALLOW_CLIENT_KEY = '1';
  process.env.NODE_ENV = 'development';
  // stub fetch used by callOpenRouter
  (global as any).fetch = async () => ({ status: 200, json: async () => fakeSuccess });

  await startServerWithEnv({ DEV_ALLOW_CLIENT_KEY: '1' });
  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json', 'x-openrouter-key': 'abc' }, body: JSON.stringify({ path: '/x' }) });
  assert(res.status === 200, 'expected success when DEV_ALLOW_CLIENT_KEY=1 and header provided');
  await stopServer();
});

test('generate-mock validates JSON output', async () => {
  // stub fetch to return invalid JSON content
  (global as any).fetch = async () => ({ status: 200, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }) });
  await startServerWithEnv({ OPENROUTER_API_KEY: 'server' });
  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/test' }) });
  assert(res.status === 502, 'expected 502 when model output is not JSON');
  const jb: any = await res.json();
  assert(jb.error === 'invalid_model_output');
  await stopServer();

  // stub fetch to return valid JSON in message content
  (global as any).fetch = async () => ({ status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true,"n":3}' } }] }) });
  await startServerWithEnv({ OPENROUTER_API_KEY: 'server' });
  const res2 = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/test' }) });
  assert(res2.status === 200, 'expected 200 when model output is valid JSON');
  const jb2: any = await res2.json();
  assert(jb2.json && jb2.json.ok === true && jb2.json.n === 3, 'expected parsed JSON match');
  await stopServer();
});

test('client header rejected in production even if DEV_ALLOW_CLIENT_KEY=1', async () => {
  process.env.DEV_ALLOW_CLIENT_KEY = '1';
  process.env.NODE_ENV = 'production';

  // callOpenRouter should NOT be invoked
  const mod = await import('../scripts/openrouter-proxy.cjs');
  const appFactory = (mod as any).createApp || (mod as any).default || mod;
  const app = appFactory({ quiet: true, openRouterApiKey: null, callOpenRouter: async () => { throw new Error('callOpenRouter should not be invoked when production blocks client key'); } });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(baseUrl + '/openrouter/generate-mock', { method: 'POST', headers: { 'content-type': 'application/json', 'x-openrouter-key': 'abc' }, body: JSON.stringify({ path: '/x' }) });
  assert(res.status === 401, 'expected 401 when production blocks client key');
  await stopServer();
});

test('quiet option suppresses console logs/warnings', async () => {
  let warned = false;
  let logged = false;
  const realWarn = console.warn;
  const realLog = console.log;
  console.warn = (() => { warned = true; }) as any;
  console.log = (() => { logged = true; }) as any;
  try {
    const mod = await import('../scripts/openrouter-proxy.cjs');
    const appFactory = (mod as any).createApp || (mod as any).default || mod;
    appFactory({ quiet: true });
    assert(!warned && !logged, 'quiet should suppress initial logs');
  } finally {
    console.warn = realWarn;
    console.log = realLog;
  }
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
