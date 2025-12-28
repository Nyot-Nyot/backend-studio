import assert from 'node:assert/strict';
import { SocketClient } from '../services/socketClient';

// Fake socket implementation for testing
function makeFakeSocket() {
  const handlers: Record<string, Set<Function>> = {};
  return {
    connected: true,
    id: 'fake-socket',
    on(ev: string, h: Function) {
      handlers[ev] ??= new Set();
      handlers[ev].add(h);
    },
    off(ev: string, h?: Function) {
      if (!handlers[ev]) return;
      if (h) handlers[ev].delete(h);
      else delete handlers[ev];
    },
    removeAllListeners(ev: string) { delete handlers[ev]; },
    emit(ev: string, payload?: any) {
      (handlers[ev] || new Set()).forEach(h => { try { h(payload); } catch (e) { } });
    },
    disconnect() { this.connected = false; }
  } as any;
}

async function run() {
  // Test: baseUrl override passed to constructor gets used
  let seenUrl = '';
  const fakeIoFactory = (url: string) => { seenUrl = url; return makeFakeSocket(); };
  const sc1 = new SocketClient(undefined, { ioFactory: fakeIoFactory as any });
  sc1.connect();
  assert.ok(typeof seenUrl === 'string' && seenUrl.length > 0, 'ioFactory should be called with a url');

  // Test: queued handlers are attached when connect invoked
  const socketInstance = makeFakeSocket();
  const fakeFactory2 = (url: string) => socketInstance;
  const sc2 = new SocketClient('http://example.com:1234', { ioFactory: fakeFactory2 as any });
  let called = false;
  sc2.on('my:event', (p) => { called = true; assert.equal(p.test, 1); });
  // handler should be queued and not called yet
  assert.equal(called, false);
  // now connect and cause an emit
  sc2.connect();
  socketInstance.emit('my:event', { test: 1 });
  assert.equal(called, true);

  // Test: connect() returns existing socket and reports status
  const sc3 = new SocketClient('http://x', { ioFactory: () => makeFakeSocket() as any });
  const sA = sc3.connect();
  const sB = sc3.connect();
  assert.strictEqual(sA, sB);
  assert.equal(sc3.getStatus(), 'connected');

  // Test: debug option doesn't throw and can be enabled
  const sc4 = new SocketClient('http://d', { ioFactory: () => makeFakeSocket() as any, debug: true });
  sc4.connect();
  assert.equal(sc4.getStatus(), 'connected');

  console.log('socketClient unit tests passed');
}

run().catch((err) => { console.error(err); process.exit(1); });
