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
const PORT = 9200 + Math.floor(Math.random() * 200);
let srv: any;

async function startServer() {
  const PORT = 9200 + Math.floor(Math.random() * 200);
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
  }).then(() => ({ port: PORT }));
}

async function stopServer() {
  if (srv) {
    srv.kill('SIGINT');
    await wait(400);
    srv = null;
  }
}

async function fetchJson(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}


test('socket server emits log:new and client receives it', async () => {
  const started = await startServer();
  const client = new SocketClient(`http://localhost:${started.port}`);
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
  await fetchJson(`http://localhost:${started.port}/emit-log`, payload);

  // wait for message to arrive
  await wait(500);
  console.log('received after wait', received);
  assert(received && received.id === 't1', 'received payload');

  client.off('log:new', handler);
  client.disconnect();
  await stopServer();
});

// Test publish from client using socket.emit('log:publish')
test('client can publish logs and others receive them', async () => {
  const started = await startServer();
  const sender = new SocketClient(`http://localhost:${started.port}`);
  const receiver = new SocketClient(`http://localhost:${started.port}`);
  sender.connect();
  receiver.connect();

  const start = Date.now();
  while ((!sender.isConnected() || !receiver.isConnected()) && Date.now() - start < 2000) {
    await wait(50);
  }
  if (!sender.isConnected() || !receiver.isConnected()) throw new Error('sockets did not connect');

  let received: any = null;
  const handler = (payload: any) => { received = payload; };
  receiver.on('log:new', handler);
  // join logs:all to receive broadcasted messages
  receiver.join('logs:all');

  const payload = { id: 'pub1', ts: Date.now(), message: 'hello world' };
  sender.emit('log:publish', payload);

  await wait(500);
  if (!received || received.id !== 'pub1') throw new Error('receiver did not get published log');

  receiver.off('log:new', handler);
  sender.disconnect();
  receiver.disconnect();
  await stopServer();
});

// Rate limit behavior for socket publish
test('socket publish is rate limited per socket', async () => {
  // configure server to only allow 1 message per window
  process.env.SOCKET_RATE_LIMIT = '1';
  process.env.SOCKET_RATE_WINDOW_MS = '5000';
  const started = await startServer();

  const client = new SocketClient(`http://localhost:${started.port}`);
  client.connect();
  const start = Date.now();
  while (!client.isConnected() && Date.now() - start < 2000) {
    await wait(50);
  }
  if (!client.isConnected()) throw new Error('socket did not connect');

  let ack = false;
  let err: any = null;
  client.on('log:ack', () => { ack = true; });
  client.on('error', (e) => { err = e; });

  // emit twice
  client.emit('log:publish', { id: 'r1' });
  client.emit('log:publish', { id: 'r2' });

  await wait(500);
  if (!ack) throw new Error('expected ack for first publish');
  if (!err || err.error !== 'rate_limited') throw new Error('expected rate_limited error for second publish');

  client.disconnect();
  // cleanup env overrides
  delete process.env.SOCKET_RATE_LIMIT;
  delete process.env.SOCKET_RATE_WINDOW_MS;
  await stopServer();
});
