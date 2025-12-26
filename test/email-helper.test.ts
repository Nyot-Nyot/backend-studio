import fetch from 'node-fetch';

const mod = await import('../scripts/email-helper.cjs');
const createApp = (mod as any).createApp || mod;
const app = typeof createApp === 'function' ? createApp() : createApp;

let server: any;
let base = '';

async function start() {
  return new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

async function stop() {
  return new Promise<void>(resolve => server.close(() => resolve()));
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

function assert(cond: boolean, msg = 'assert') { if (!cond) throw new Error(msg); }

test('upload without file returns 400', async () => {
  await start();
  const res = await fetch(base + '/upload-temp', { method: 'POST' });
  assert(res.status === 400, 'expected 400');
  await stop();
});

(async () => {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
