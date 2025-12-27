import FormData from 'form-data';
import { createRequire } from 'module';
import fetch from 'node-fetch';

// helper to load a fresh instance of the CJS module with current env
function freshRequire(path: string) {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve(path);
  delete require.cache[resolved];
  return require(path);
}

function startApp(mod: any) {
  const createApp = (mod as any).createApp || mod;
  const app = typeof createApp === 'function' ? createApp() : createApp;
  let server: any;
  let base = '';
  return {
    async start() {
      return new Promise<void>(resolve => {
        server = app.listen(0, () => {
          const addr = server.address();
          base = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    },
    async stop() {
      return new Promise<void>(resolve => server.close(() => resolve()));
    },
    url(path: string) {
      return base + path;
    },
  };
}

async function doUpload(url: string, filename: string, body: Buffer | string) {
  const form = new FormData();
  form.append('file', body, { filename, contentType: 'application/octet-stream' });
  const res = await fetch(url, { method: 'POST', body: form as any, headers: form.getHeaders() });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch (e) { /* ignore */ }
  return { status: res.status, body: text, json };
}

// Simple runner for a few tests so the file can be run directly like other tests in repo
let pass = 0;
let fail = 0;
function assert(cond: boolean, msg = 'assert') { if (!cond) throw new Error(msg); }
function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      pass++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      fail++;
    }
  };
}

// Tests
const tests: Array<() => Promise<void>> = [];

tests.push(test('disallowed extension returns 400 JSON', async () => {
  const mod = freshRequire('../scripts/email-helper.cjs');
  const app = startApp(mod);
  await app.start();
  const r = await doUpload(app.url('/upload-temp'), 'bad.exe', 'x');
  assert(r.status === 400, `expected 400 got ${r.status}`);
  assert(r.json && r.json.error === 'File type not allowed', `unexpected body ${r.body}`);
  await app.stop();
}));

tests.push(test('allowed extension returns url', async () => {
  const mod = freshRequire('../scripts/email-helper.cjs');
  const app = startApp(mod);
  await app.start();
  const r = await doUpload(app.url('/upload-temp'), 'good.txt', 'hello');
  assert(r.status === 200, `expected 200 got ${r.status}`);
  assert(r.json && typeof r.json.url === 'string' && r.json.url.includes('/files/'), `unexpected body ${r.body}`);
  await app.stop();
}));

tests.push(test('rate limit enforced (limit=1)', async () => {
  // set env and import fresh
  const oldLimit = process.env.EMAIL_HELPER_RATE_LIMIT;
  const oldWindow = process.env.EMAIL_HELPER_RATE_WINDOW_HOURS;
  process.env.EMAIL_HELPER_RATE_LIMIT = '1';
  process.env.EMAIL_HELPER_RATE_WINDOW_HOURS = '1';
  const mod = freshRequire('../scripts/email-helper.cjs');
  const app = startApp(mod);
  await app.start();
  const ok = await doUpload(app.url('/upload-temp'), 'a.txt', '1');
  assert(ok.status === 200, `first upload should pass (${ok.status})`);
  const again = await doUpload(app.url('/upload-temp'), 'b.txt', '2');
  assert(again.status === 429, `second upload should be rate-limited (${again.status})`);
  assert(again.json && again.json.error === 'Too many upload requests');
  await app.stop();
  // restore
  if (oldLimit === undefined) delete process.env.EMAIL_HELPER_RATE_LIMIT; else process.env.EMAIL_HELPER_RATE_LIMIT = oldLimit;
  if (oldWindow === undefined) delete process.env.EMAIL_HELPER_RATE_WINDOW_HOURS; else process.env.EMAIL_HELPER_RATE_WINDOW_HOURS = oldWindow;
}));

(async () => {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
