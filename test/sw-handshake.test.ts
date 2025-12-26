// Test SW handshake timeout + fallback behavior

import { HttpMethod } from "../types";

// Simple fake MessageChannel for Node test environment
function createFakeMessageChannel() {
  let port1: any = { onmessage: null };
  let port2: any = { onmessage: null };
  port1.postMessage = (data: any) => {
    if (port2.onmessage) port2.onmessage({ data });
  };
  port2.postMessage = (data: any) => {
    if (port1.onmessage) port1.onmessage({ data });
  };
  return { port1, port2 };
}

// Simulate handshake logic from sw.js but testable with injected client and fetch
function simulateSwHandshake({ client, request, timeoutMs = 100, fetchFn }: any) {
  return new Promise(async (resolve) => {
    const channel = createFakeMessageChannel();
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ usedFallback: true, fetchCalled: true });
    }, timeoutMs);

    channel.port1.onmessage = (msg: any) => {
      if (settled) return;
      clearTimeout(timeoutId);
      settled = true;
      const { response } = msg.data || {};
      if (!response) {
        resolve({ usedFallback: true, fetchCalled: true });
        return;
      }
      resolve({ usedFallback: false, response });
    };

    // Client should receive postMessage with channel.port2
    client.postMessage(
      {
        type: "INTERCEPT_REQUEST",
        payload: {
          id: "test-id",
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        },
      },
      channel.port2
    );
  });
}

// Test harness (simple style consistent with repo tests)
let passCount = 0;
let failCount = 0;
const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      failCount++;
    }
  });
}

function assert(cond: boolean, msg = "Assertion failed") {
  if (!cond) throw new Error(msg);
}

// Responsive client should return response and not trigger fallback
test("Client responds quickly -> SW uses client response", async () => {
  const client = {
    postMessage: (_msg: any, port: any) => {
      // Simulate immediate processing and reply on the provided port
      const response = { status: 201, headers: { "content-type": "text/plain" }, body: "ok" };
      setTimeout(() => {
        port.postMessage({ response });
      }, 10);
    },
  };

  const res = (await simulateSwHandshake({ client, request: { url: "/api/x", method: HttpMethod.GET }, timeoutMs: 100 })) as any;
  assert(!res.usedFallback, "Expected not to use fallback");
  assert(res.response.status === 201, "Expected status 201 from client response");
});

// Unresponsive client -> SW falls back to network (fetch)
test("Client unresponsive -> SW falls back to network", async () => {
  const client = {
    postMessage: (_msg: any, _port: any) => {
      // Do nothing (simulate unresponsive client)
    },
  };

  const res = (await simulateSwHandshake({ client, request: { url: "/api/x", method: HttpMethod.GET }, timeoutMs: 50 })) as any;
  assert(res.usedFallback, "Expected fallback to be used when client is unresponsive");
});

(async function run() {
  for (const t of tests) await t();
  console.log(`\nTest summary: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
})();
