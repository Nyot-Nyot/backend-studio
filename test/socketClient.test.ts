import { spawn } from 'child_process';
import { setTimeout as wait } from 'timers/promises';
import { SocketClient } from '../services/socketClient';

function test(name: string, fn: () => Promise<void>) {
  fn()
    .then(() => console.log(`✅ PASS: ${name}`))
    .catch((e) => {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   ${(e as Error).message}`);
    });
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('🧪 socketClient integration tests\n');

// Start a socket-server process on a random port
const PORT = 9210;
let srv: any;

async function startServer() {
  return new Promise<void>((resolve, reject) => {
    srv = spawn(process.execPath, ['scripts/socket-server.cjs'], {
      env: { ...process.env, SOCKET_PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (d: Buffer) => {
      const s = d.toString();
      if (s.includes("listening on")) {
        srv.stdout.off('data', onData);
        resolve();
      }
    };
    srv.stdout.on('data', onData);
    srv.on('error', reject);
    // safety timeout
    setTimeout(() => reject(new Error('server failed to start')), 5000);
  });
}

async function stopServer() {
  if (srv) {
    srv.kill('SIGINT');
    await wait(200);
  }
}

async function fetchJson(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}


test('socket server emits log:new and client receives it', async () => {
  await startServer();
  const client = new SocketClient(`http://localhost:${PORT}`);
  client.connect();

  // wait for socket to connect (max 2s)
  const start = Date.now();
  while (!client.isConnected() && Date.now() - start < 2000) {
    await wait(50);
  }
  if (!client.isConnected()) throw new Error('socket did not connect');

  let received: any = null;
  const handler = (payload: any) => {
    console.log('handler got', payload);
    received = payload;
  };
  client.on('log:new', handler);

  const payload = { id: 't1', ts: Date.now(), method: 'GET', path: '/api/test', statusCode: 200, workspaceId: 'w1' };
  await fetchJson(`http://localhost:${PORT}/emit-log`, payload);

  // wait for message to arrive
  await wait(500);
  console.log('received after wait', received);
  assert(received && received.id === 't1', 'received payload');

  client.off('log:new', handler);
  client.disconnect();
  await stopServer();
});
