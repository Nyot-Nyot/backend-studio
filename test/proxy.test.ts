import { simulateRequest } from "../services/mockEngine";
import { HttpMethod, MockEndpoint } from "../types";

let passCount = 0;
let failCount = 0;
const testFns: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  testFns.push(async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (error: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${error.message}`);
      failCount++;
    }
  });
}

async function finalizeTests() {
  for (const run of testFns) {
    await run();
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected && actual != expected) throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
}

console.log("🧪 Starting Proxy simulateRequest Tests\n");

// Helper to create mock endpoints
function createMockEndpoint(overrides: Partial<MockEndpoint> = {}): MockEndpoint {
  return {
    id: "mock-" + Math.random().toString(36).slice(2, 9),
    projectId: "project-1",
    name: "Proxy Test Mock",
    method: HttpMethod.GET,
    path: "/api/proxy",
    statusCode: 200,
    responseBody: JSON.stringify({ proxied: false }),
    headers: [],
    isActive: true,
    delay: 0,
    version: "1.0",
    createdAt: Date.now(),
    requestCount: 0,
    ...overrides,
  } as MockEndpoint;
}

// Save original fetch
const originalFetch = (global as any).fetch;

// Test 1: Successful proxy
test("Proxy forwards request and returns proxied response", async () => {
  // Stub fetch
  (global as any).fetch = async (url: string, opts: any) => {
    return {
      status: 201,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ proxied: true, url }),
    } as any;
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://api.example.com' }
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 201, 'Should return proxied status');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.proxied === true, 'Should indicate proxied body');
});

// Test 2: Proxy failure without fallback -> 502
test("Proxy failure returns 502 when fallback disabled", async () => {
  (global as any).fetch = async () => {
    throw new Error('network failure');
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://bad.example.com', fallbackToMock: false }
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 502, 'Should return 502 on proxy failure');
});

// Test 3: Proxy failure with fallback -> return local mock body
test("Proxy failure falls back to local mock when enabled", async () => {
  (global as any).fetch = async () => {
    throw new Error('network down');
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://bad.example.com', fallbackToMock: true },
    responseBody: JSON.stringify({ fallback: true }),
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 200, 'Should return mock status on fallback');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.fallback === true, 'Should return fallback body');
});

// Test 4: Unsupported scheme should be rejected
test("Proxy rejects non-http(s) proxy targets", async () => {
  let fetchCalled = false;
  (global as any).fetch = async () => { fetchCalled = true; throw new Error('should not be called'); };

  const mock = createMockEndpoint({ proxy: { enabled: true, target: 'ftp://example.com' } });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 400, 'Should reject unsupported scheme');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.error === 'Invalid Proxy Target', 'Should return invalid proxy target error');
  assert(!fetchCalled, 'fetch should not be called for invalid target');
});

// Test 5: Localhost target should be rejected
test("Proxy rejects localhost targets", async () => {
  (global as any).fetch = async () => { throw new Error('should not be called'); };

  const mock = createMockEndpoint({ proxy: { enabled: true, target: 'http://localhost' } });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 400, 'Should reject localhost target');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.error === 'Invalid Proxy Target', 'Should return invalid proxy target error');
});

// Test 6: Private IP target should be rejected
test("Proxy rejects private IP targets", async () => {
  (global as any).fetch = async () => { throw new Error('should not be called'); };

  const mock = createMockEndpoint({ proxy: { enabled: true, target: 'http://192.168.0.1' } });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 400, 'Should reject private IP target');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.error === 'Invalid Proxy Target', 'Should return invalid proxy target error');
});

// Test 7: Proxy timeout returns 502 when fallback disabled
test("Proxy timeout returns 502 when fallback disabled", async () => {
  (global as any).fetch = async (_url: string, opts: any) => {
    return new Promise((_resolve, reject) => {
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }
      // never resolve
    });
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://slow.example.com', timeout: 20, fallbackToMock: false }
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 502, 'Should return 502 on timeout');
});

// Test 8: Proxy timeout falls back when fallback enabled
test("Proxy timeout falls back to local mock when enabled", async () => {
  (global as any).fetch = async (_url: string, opts: any) => {
    return new Promise((_resolve, reject) => {
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }
      // never resolve
    });
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://slow.example.com', timeout: 20, fallbackToMock: true },
    responseBody: JSON.stringify({ fallback: true }),
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    {},
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 200, 'Should return mock status on timeout fallback');
  const parsed = JSON.parse(result.response.body);
  assert(parsed.fallback === true, 'Should return fallback body on timeout');
});

// Test 9: Proxy forwards request headers
test("Proxy forwards request headers to target", async () => {
  (global as any).fetch = async (url: string, opts: any) => {
    assert(opts && opts.headers && opts.headers['x-test-header'] === 'hello', 'Should forward x-test-header');
    return {
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ ok: true }),
    } as any;
  };

  const mock = createMockEndpoint({
    proxy: { enabled: true, target: 'https://api.example.com' }
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    'http://app.local/api/proxy',
    { 'x-test-header': 'hello' } as any,
    '',
    [mock],
    []
  );

  assertEqual(result.response.status, 200, 'Should return proxied status');
});

// Restore fetch
(global as any).fetch = originalFetch;

(async () => {
  await finalizeTests();
  console.log(`\nTests run: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  if (failCount > 0) process.exit(1); else process.exit(0);
})();
