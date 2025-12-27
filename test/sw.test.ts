
/**
 * Simple test harness for service worker handler logic
 */
import { strict as assert } from 'assert';

// Minimal polyfills for Headers and Response in Node test environment
class SimpleHeaders {
  map: Record<string, string> = {};
  append(k: string, v: string) { this.map[k.toLowerCase()] = String(v); }
}

class SimpleResponse {
  body: any;
  status: number;
  headers: any;
  constructor(body: any, init: any = {}) { this.body = body; this.status = init.status ?? 200; this.headers = init.headers ?? {}; }
  async text() { return typeof this.body === 'string' ? this.body : JSON.stringify(this.body); }
}

// Expose simple globals for the test
(globalThis as any).Headers = (globalThis as any).Headers || SimpleHeaders;
(globalThis as any).Response = (globalThis as any).Response || SimpleResponse;

console.log('🧪 [sw] Running Service Worker handler tests');

// Setup a minimal Service Worker global environment
(globalThis as any).self = (globalThis as any).self || globalThis;
(globalThis as any).self.addEventListener = (globalThis as any).self.addEventListener || (() => { });
(globalThis as any).self.removeEventListener = (globalThis as any).self.removeEventListener || (() => { });
(globalThis as any).caches = (globalThis as any).caches || { match: async (_req: any) => null };
(globalThis as any).MessageChannel = (globalThis as any).MessageChannel || class {
  port1: any = { onmessage: null, postMessage: (m: any) => { } };
  port2: any = { postMessage: (m: any) => { if (this.port1 && typeof this.port1.onmessage === 'function') this.port1.onmessage({ data: m }); } };
};

// import the sw.js to attach __sw_handleRequest (it will attach to globalThis)
await import('../sw.js');

const handleRequest = (globalThis as any).__sw_handleRequest;
if (!handleRequest) throw new Error('handleRequest not exposed');

// Helper to create a fake request
const makeRequest = (url = 'https://example.com/api/test', method = 'GET', headers: Record<string, string> = {}) => {
  return {
    url,
    method,
    headers: new Map(Object.entries(headers)),
    clone() { return this; },
    async text() { return ''; },
  } as any;
};

async function testNoClientFallsBackToNetwork() {
  // no clients
  (globalThis as any).clients = {
    matchAll: async () => []
  };

  let called = false;
  (globalThis as any).fetch = async (req: any) => { called = true; return new SimpleResponse('network', { status: 200 }); };

  const ev = { request: makeRequest() } as any;
  const res = await handleRequest(ev);
  assert(called, 'fetch should be called');
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, 'network');
}

async function testClientRespondsBeforeNetwork() {
  // one client that will respond quickly
  const mockClient = {
    visibilityState: 'visible',
    postMessage(payload: any, transfer: any[]) {
      // transfer[0] is MessagePort; send back response after small delay
      const port: any = transfer && transfer[0];
      setTimeout(() => {
        port.postMessage({ response: { status: 201, headers: { 'x-test': '1' }, body: 'client' } });
      }, 10);
    }
  } as any;

  (globalThis as any).clients = { matchAll: async () => [mockClient] };

  (globalThis as any).fetch = async (req: any) => {
    // delay network so client wins
    await new Promise(r => setTimeout(r, 50));
    return new SimpleResponse('network', { status: 200 });
  };

  const ev = { request: makeRequest() } as any;
  const res = await handleRequest(ev);
  assert.equal(res.status, 201);
  const text = await res.text();
  assert.equal(text, 'client');
}

async function testClientTimeoutFallsBackToNetwork() {
  // client that does not respond
  const slowClient = {
    visibilityState: 'visible',
    postMessage(payload: any, transfer: any[]) {
      // never respond
    }
  } as any;

  (globalThis as any).clients = { matchAll: async () => [slowClient] };

  (globalThis as any).fetch = async (req: any) => {
    return new SimpleResponse('network-late', { status: 200 });
  };

  const ev = { request: makeRequest() } as any;
  const res = await handleRequest(ev);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, 'network-late');
}


// Run tests sequentially
const tests: Array<{ name: string, fn: () => Promise<void> }> = [
  { name: 'noClientFallsBackToNetwork', fn: testNoClientFallsBackToNetwork },
  { name: 'clientRespondsBeforeNetwork', fn: testClientRespondsBeforeNetwork },
  { name: 'clientTimeoutFallsBackToNetwork', fn: testClientTimeoutFallsBackToNetwork },
];

(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.name}`);
    } catch (err: any) {
      console.error(`❌ FAIL: ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }
  console.log('📊 All SW tests passed');
})();
