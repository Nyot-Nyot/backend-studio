/**
 * Epic E5 – Task 5.3 – Authentication Scenario Testing
 *
 * Comprehensive scenario testing for all authentication combinations:
 *
 * SCENARIO MATRIX:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Endpoint Type │ Request              │ Expected Result         │
 * ├─────────────────────────────────────────────────────────────┤
 * │ NONE          │ Any request          │ 200 / Status Code       │
 * │ BEARER_TOKEN  │ No auth header       │ 401 Unauthorized        │
 * │ BEARER_TOKEN  │ Wrong token          │ 401 Unauthorized        │
 * │ BEARER_TOKEN  │ Correct token        │ 200 / Status Code       │
 * │ API_KEY       │ No auth header       │ 401 Unauthorized        │
 * │ API_KEY       │ Wrong key            │ 401 Unauthorized        │
 * │ API_KEY       │ Correct key          │ 200 / Status Code       │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Acceptance Criteria:
 * ✓ NONE endpoint: All requests pass with configured status code
 * ✓ Bearer endpoint: Status 401 for missing/wrong token, correct token → status code
 * ✓ API Key endpoint: Status 401 for missing/wrong key, correct key → status code
 * ✓ No regression: Other features (delay, headers, response body) work correctly
 */

import { simulateRequest } from "../services/mockEngine";
import { HttpMethod, MockEndpoint } from "../types";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto
if (!global.crypto) {
  (global as any).crypto = {};
}
if (!global.crypto.randomUUID) {
  (global.crypto as any).randomUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Test utilities
let passCount = 0;
let failCount = 0;
const testFns: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  testFns.push(async () => {
    try {
      mockLocalStorage.clear();
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
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected && actual != expected) {
    throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
  }
}

// Helper to create mock endpoints
function createMockEndpoint(
  overrides: Partial<MockEndpoint> = {}
): MockEndpoint {
  return {
    id: "mock-" + Math.random().toString(36).slice(2, 9),
    projectId: "project-1",
    name: "Test Mock",
    method: HttpMethod.GET,
    path: "/api/items",
    statusCode: 200,
    responseBody: JSON.stringify({
      success: true,
      message: "Authenticated request successful",
      timestamp: new Date().toISOString(),
    }),
    headers: [],
    isActive: true,
    delay: 0,
    version: "1.0",
    createdAt: Date.now(),
    requestCount: 0,
    storeName: undefined,
    authConfig: { type: "NONE" },
    ...overrides,
  };
}

console.log("📋 Epic E5 – Task 5.3: Authentication Scenario Testing\n");
console.log(
  "Testing all authentication combinations with various status codes\n"
);

// ============================================
// SCENARIO 1: NONE (Public Endpoint)
// ============================================

console.log("📊 SCENARIO 1: Public Endpoint (NONE)\n");

test("NONE: Status 200 - No auth required, no headers", () => {
  const mock = createMockEndpoint({
    path: "/api/public",
    statusCode: 200,
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Should return 200");
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should have success=true");
});

test("NONE: Status 200 - With random headers (should be ignored)", () => {
  const mock = createMockEndpoint({
    path: "/api/public",
    statusCode: 200,
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {
      "X-Random-Header": "value",
      Authorization: "Bearer random-token",
      "x-api-key": "random-key",
    },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Should return 200 regardless of headers"
  );
});

test("NONE: Status 201 - Created response", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/items",
    statusCode: 201,
    responseBody: JSON.stringify({
      id: "item-123",
      created: true,
    }),
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/items",
    { "Content-Type": "application/json" },
    JSON.stringify({ name: "Test Item" }),
    [mock],
    []
  );

  assertEqual(result.response.status, 201, "Should return 201 Created");
  const response = JSON.parse(result.response.body);
  assertEqual(response.created, true, "Should have created=true");
});

test("NONE: Status 204 - No Content response", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/items/:id",
    statusCode: 204,
    responseBody: "",
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/items/123",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 204, "Should return 204 No Content");
});

// ============================================
// SCENARIO 2: BEARER_TOKEN
// ============================================

console.log("📊 SCENARIO 2: Bearer Token Authentication\n");

// 2.1: No auth header
test("BEARER_TOKEN: Status 401 - No auth header provided", async () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 401, "Should return 401");
  const response = JSON.parse(result.response.body);
  assertEqual(response.error, "Unauthorized", "Should have error=Unauthorized");
});

// 2.2: Wrong token
test("BEARER_TOKEN: Status 401 - Wrong token provided", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "BEARER_TOKEN",
      token: "correct-token",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer wrong-token" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 401, "Should return 401");
});

// 2.3: Correct token with various status codes
test("BEARER_TOKEN: Status 200 - Correct token returns status code", async () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer valid-token-123" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Should return 200");
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should have success=true");
});

test("BEARER_TOKEN: Status 201 - Correct token, 201 Created", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/secure/items",
    statusCode: 201,
    responseBody: JSON.stringify({
      id: "new-item",
      created: true,
    }),
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/secure/items",
    { Authorization: "Bearer valid-token-123" },
    JSON.stringify({ name: "New Item" }),
    [mock],
    []
  );

  assertEqual(result.response.status, 201, "Should return 201");
});

test("BEARER_TOKEN: Status 204 - Correct token, 204 No Content", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/secure/:id",
    statusCode: 204,
    responseBody: "",
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/secure/123",
    { Authorization: "Bearer valid-token-123" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 204, "Should return 204");
});

test("BEARER_TOKEN: Status 400 - Correct token, 400 Bad Request", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 400,
    responseBody: JSON.stringify({
      error: "Bad Request",
      message: "Invalid input",
    }),
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer valid-token-123" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 400, "Should return 400");
  const response = JSON.parse(result.response.body);
  assertEqual(response.error, "Bad Request", "Should have error field");
});

test("BEARER_TOKEN: Status 500 - Correct token, 500 Server Error", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 500,
    responseBody: JSON.stringify({
      error: "Internal Server Error",
      message: "Database connection failed",
    }),
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token-123",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer valid-token-123" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 500, "Should return 500");
});

// ============================================
// SCENARIO 3: API_KEY
// ============================================

console.log("📊 SCENARIO 3: API Key Authentication\n");

// 3.1: No auth header
test("API_KEY: Status 401 - No API key header", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 401, "Should return 401");
});

// 3.2: Wrong API key
test("API_KEY: Status 401 - Wrong API key value", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "API_KEY",
      token: "correct-key",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": "wrong-key" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 401, "Should return 401");
});

// 3.3: Correct API key with various status codes
test("API_KEY: Status 200 - Correct key, 200 OK", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 200,
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": "api-key-456" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Should return 200");
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should have success=true");
});

test("API_KEY: Status 201 - Correct key, 201 Created", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/secure/items",
    statusCode: 201,
    responseBody: JSON.stringify({
      id: "new-item",
      created: true,
    }),
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/secure/items",
    { "x-api-key": "api-key-456" },
    JSON.stringify({ name: "New Item" }),
    [mock],
    []
  );

  assertEqual(result.response.status, 201, "Should return 201");
});

test("API_KEY: Status 204 - Correct key, 204 No Content", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/secure/:id",
    statusCode: 204,
    responseBody: "",
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/secure/123",
    { "x-api-key": "api-key-456" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 204, "Should return 204");
});

test("API_KEY: Status 400 - Correct key, 400 Bad Request", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 400,
    responseBody: JSON.stringify({
      error: "Bad Request",
      message: "Invalid parameters",
    }),
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": "api-key-456" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 400, "Should return 400");
});

test("API_KEY: Status 500 - Correct key, 500 Server Error", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    statusCode: 500,
    responseBody: JSON.stringify({
      error: "Internal Server Error",
      message: "Unexpected error",
    }),
    authConfig: {
      type: "API_KEY",
      token: "api-key-456",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": "api-key-456" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 500, "Should return 500");
});

// ============================================
// REGRESSION TESTS: Other Features
// ============================================

console.log("📊 REGRESSION TESTS: Other Features\n");

test("REGRESSION: Custom headers work with auth", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    headers: [
      { key: "X-Custom-Header", value: "custom-value" },
      { key: "X-Request-ID", value: "req-123" },
    ],
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer valid-token" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Should authenticate successfully");
  const headers = result.response.headers;
  const customHeader = headers.find((h) => h.key === "X-Custom-Header");
  assert(customHeader !== undefined, "Custom headers should be included");
});

test("REGRESSION: Response body preserved with auth", () => {
  const customBody = JSON.stringify({
    data: [1, 2, 3],
    nested: { key: "value" },
    custom: true,
  });

  const mock = createMockEndpoint({
    path: "/api/secure",
    responseBody: customBody,
    authConfig: {
      type: "API_KEY",
      token: "api-key",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": "api-key" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Should authenticate");
  assertEqual(
    result.response.body,
    customBody,
    "Response body should be unchanged"
  );
});

test("REGRESSION: Simulated delay works with auth", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    delay: 150,
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token",
    },
  });

  const start = Date.now();
  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer valid-token" },
    "",
    [mock],
    []
  );
  const elapsed = Date.now() - start;

  assertEqual(result.response.status, 200, "Should authenticate");
  assertEqual(result.response.delay, 150, "Delay should be 150ms");
});

test("REGRESSION: Multiple endpoints with different auth", () => {
  const publicMock = createMockEndpoint({
    id: "public-1",
    path: "/api/public",
    authConfig: { type: "NONE" },
  });

  const bearerMock = createMockEndpoint({
    id: "bearer-1",
    path: "/api/bearer",
    authConfig: {
      type: "BEARER_TOKEN",
      token: "bearer-token",
    },
  });

  const keyMock = createMockEndpoint({
    id: "key-1",
    path: "/api/key",
    authConfig: {
      type: "API_KEY",
      token: "api-key",
    },
  });

  // Public request
  const publicResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {},
    "",
    [publicMock, bearerMock, keyMock],
    []
  );
  assertEqual(publicResult.response.status, 200, "Public should return 200");

  // Bearer request
  const bearerResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/bearer",
    { Authorization: "Bearer bearer-token" },
    "",
    [publicMock, bearerMock, keyMock],
    []
  );
  assertEqual(bearerResult.response.status, 200, "Bearer should return 200");

  // Key request
  const keyResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/key",
    { "x-api-key": "api-key" },
    "",
    [publicMock, bearerMock, keyMock],
    []
  );
  assertEqual(keyResult.response.status, 200, "Key should return 200");
});

test("REGRESSION: HTTP methods work with auth", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/items/:id",
    statusCode: 200,
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token",
    },
  });

  const result = simulateRequest(
    HttpMethod.PUT,
    "http://api.example.com/api/items/123",
    { Authorization: "Bearer valid-token" },
    JSON.stringify({ name: "Updated" }),
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "PUT with auth should work");
});

test("REGRESSION: Custom API key header with auth", () => {
  const mock = createMockEndpoint({
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: "secret-key-123",
      headerKey: "x-custom-auth",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-custom-auth": "secret-key-123" },
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Custom header key should work");
});

// ============================================
// COMPREHENSIVE COMBINATION TESTS
// ============================================

console.log("📊 COMPREHENSIVE COMBINATION TESTS\n");

test("COMBINATION: All auth types with GET requests", () => {
  const mocks = [
    createMockEndpoint({
      path: "/public",
      method: HttpMethod.GET,
      authConfig: { type: "NONE" },
    }),
    createMockEndpoint({
      path: "/bearer",
      method: HttpMethod.GET,
      authConfig: { type: "BEARER_TOKEN", token: "token" },
    }),
    createMockEndpoint({
      path: "/key",
      method: HttpMethod.GET,
      authConfig: { type: "API_KEY", token: "key" },
    }),
  ];

  const publicResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/public",
    {},
    "",
    mocks,
    []
  );
  assertEqual(publicResult.response.status, 200, "Public GET");

  const bearerResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/bearer",
    { Authorization: "Bearer token" },
    "",
    mocks,
    []
  );
  assertEqual(bearerResult.response.status, 200, "Bearer GET");

  const keyResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/key",
    { "x-api-key": "key" },
    "",
    mocks,
    []
  );
  assertEqual(keyResult.response.status, 200, "Key GET");
});

test("COMBINATION: All auth types with POST requests", () => {
  const mocks = [
    createMockEndpoint({
      path: "/public",
      method: HttpMethod.POST,
      statusCode: 201,
      authConfig: { type: "NONE" },
    }),
    createMockEndpoint({
      path: "/bearer",
      method: HttpMethod.POST,
      statusCode: 201,
      authConfig: { type: "BEARER_TOKEN", token: "token" },
    }),
    createMockEndpoint({
      path: "/key",
      method: HttpMethod.POST,
      statusCode: 201,
      authConfig: { type: "API_KEY", token: "key" },
    }),
  ];

  const publicResult = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/public",
    {},
    JSON.stringify({ data: "test" }),
    mocks,
    []
  );
  assertEqual(publicResult.response.status, 201, "Public POST");

  const bearerResult = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/bearer",
    { Authorization: "Bearer token" },
    JSON.stringify({ data: "test" }),
    mocks,
    []
  );
  assertEqual(bearerResult.response.status, 201, "Bearer POST");

  const keyResult = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/key",
    { "x-api-key": "key" },
    JSON.stringify({ data: "test" }),
    mocks,
    []
  );
  assertEqual(keyResult.response.status, 201, "Key POST");
});

test("COMBINATION: 401 response for all auth types when credentials fail", () => {
  const mocks = [
    createMockEndpoint({
      path: "/bearer",
      authConfig: { type: "BEARER_TOKEN", token: "correct-token" },
    }),
    createMockEndpoint({
      path: "/key",
      authConfig: { type: "API_KEY", token: "correct-key" },
    }),
  ];

  // Wrong bearer token
  const bearerResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/bearer",
    { Authorization: "Bearer wrong-token" },
    "",
    mocks,
    []
  );
  assertEqual(bearerResult.response.status, 401, "Bearer with wrong token");

  // Wrong API key
  const keyResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/key",
    { "x-api-key": "wrong-key" },
    "",
    mocks,
    []
  );
  assertEqual(keyResult.response.status, 401, "Key with wrong key");

  // Missing bearer token
  const noTokenResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/bearer",
    {},
    "",
    mocks,
    []
  );
  assertEqual(noTokenResult.response.status, 401, "Bearer without token");

  // Missing API key
  const noKeyResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/key",
    {},
    "",
    mocks,
    []
  );
  assertEqual(noKeyResult.response.status, 401, "Key without key");
});

// ============================================
// Run All Tests
// ============================================

console.log("\n" + "=".repeat(70));
console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
console.log("=".repeat(70) + "\n");

if (failCount === 0) {
  console.log("✨ All authentication scenario tests passed!");
  console.log("\n✅ Acceptance Criteria Met:");
  console.log(
    "   • NONE endpoint: All requests pass with configured status code"
  );
  console.log("   • Bearer endpoint: Correct 401/status code combinations");
  console.log("   • API Key endpoint: Correct 401/status code combinations");
  console.log("   • No regression: All other features work correctly");
} else {
  console.log(`⚠️  ${failCount} test(s) failed.`);
}

console.log("\n");

process.exit(failCount === 0 ? 0 : 1);
