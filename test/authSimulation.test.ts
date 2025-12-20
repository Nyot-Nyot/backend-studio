/**
 * Epic E5 – Task 5.1 – Authentication Simulation Testing
 *
 * Test all authentication scenarios:
 * - BEARER_TOKEN: Valid & Invalid tokens, Missing Authorization header
 * - API_KEY: Valid & Invalid keys, Missing custom header
 * - NO_AUTH: Requests without authentication should pass
 *
 * Acceptance Criteria:
 * ✓ Valid credentials → 200 OK
 * ✓ Invalid credentials → 401 Unauthorized
 * ✓ Missing credentials → 401 Unauthorized
 * ✓ No auth required → 200 OK
 */

import { simulateRequest } from "../services/mockEngine";
import { MockEndpoint, HttpMethod } from "../types";

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

function test(name: string, fn: () => void) {
  try {
    mockLocalStorage.clear();
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
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

console.log("🔐 Starting Authentication Simulation Tests\n");

// ============================================
// BEARER TOKEN TESTS
// ============================================

test("BEARER_TOKEN: Valid token with Authorization header → 200", () => {
  const validToken = "secret-token-12345";
  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: `Bearer ${validToken}` },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 for valid token"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should return success response");
});

test("BEARER_TOKEN: Invalid token → 401 Unauthorized", () => {
  const validToken = "secret-token-12345";
  const invalidToken = "wrong-token";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: `Bearer ${invalidToken}` },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 for invalid token"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(
    response.error,
    "Unauthorized",
    "Should return Unauthorized error"
  );
  assert(
    response.message.includes("Invalid or missing authentication"),
    "Error message should indicate auth failure"
  );
});

test("BEARER_TOKEN: Missing Authorization header → 401 Unauthorized", () => {
  const validToken = "secret-token-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    {}, // No Authorization header
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 when header missing"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(
    response.error,
    "Unauthorized",
    "Should return Unauthorized error"
  );
});

test("BEARER_TOKEN: Malformed Authorization header (missing Bearer prefix) → 401", () => {
  const validToken = "secret-token-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  // Missing "Bearer " prefix
  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: validToken }, // No "Bearer " prefix
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 for malformed header"
  );
});

test("BEARER_TOKEN: Case-insensitive header name (authorization) → 200", () => {
  const validToken = "secret-token-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  // Using lowercase header name
  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { authorization: `Bearer ${validToken}` }, // lowercase
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Header matching should be case-insensitive"
  );
});

test("BEARER_TOKEN: Case-insensitive header name (AUTHORIZATION) → 200", () => {
  const validToken = "secret-token-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  // Using uppercase header name
  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { AUTHORIZATION: `Bearer ${validToken}` }, // UPPERCASE
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Header matching should be case-insensitive"
  );
});

// ============================================
// API KEY TESTS
// ============================================

test("API_KEY: Valid key with default header (x-api-key) → 200", () => {
  const validKey = "api-key-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
      // headerKey defaults to 'x-api-key'
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": validKey },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 for valid API key"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should return success response");
});

test("API_KEY: Invalid key → 401 Unauthorized", () => {
  const validKey = "api-key-12345";
  const invalidKey = "wrong-key";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": invalidKey },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 for invalid key"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(
    response.error,
    "Unauthorized",
    "Should return Unauthorized error"
  );
});

test("API_KEY: Missing default header (x-api-key) → 401", () => {
  const validKey = "api-key-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    {}, // No x-api-key header
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 when header missing"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(
    response.error,
    "Unauthorized",
    "Should return Unauthorized error"
  );
});

test("API_KEY: Custom header key → 200", () => {
  const validKey = "custom-key-value";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
      headerKey: "x-custom-auth", // Custom header
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-custom-auth": validKey },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 with custom header"
  );
});

test("API_KEY: Custom header key with invalid value → 401", () => {
  const validKey = "custom-key-value";
  const invalidKey = "wrong-value";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
      headerKey: "x-custom-auth",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-custom-auth": invalidKey },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 with invalid custom key"
  );
});

test("API_KEY: Wrong custom header name (using default) → 401", () => {
  const validKey = "custom-key-value";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
      headerKey: "x-custom-auth",
    },
  });

  // Sending key in wrong header
  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "x-api-key": validKey }, // Wrong header
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "Status should be 401 with wrong header"
  );
});

test("API_KEY: Case-insensitive header name (x-api-key) → 200", () => {
  const validKey = "api-key-12345";

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "API_KEY",
      token: validKey,
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { "X-API-KEY": validKey }, // Different casing
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Header matching should be case-insensitive"
  );
});

// ============================================
// NO AUTH TESTS
// ============================================

test("NO_AUTH: Request without any credentials → 200", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/public",
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {}, // No headers
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200 without auth");
});

test("NO_AUTH: Request with any headers → 200", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/public",
    authConfig: { type: "NONE" },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {
      Authorization: "Bearer random-token",
      "x-api-key": "random-key",
    }, // Headers don't matter
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 even with random headers"
  );
});

// ============================================
// MIXED SCENARIOS
// ============================================

test("Multiple endpoints with different auth types", () => {
  const bearerToken = "bearer-token-123";
  const apiKey = "api-key-456";

  const bearerMock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/bearer-secured",
    authConfig: {
      type: "BEARER_TOKEN",
      token: bearerToken,
    },
  });

  const apiKeyMock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/key-secured",
    authConfig: {
      type: "API_KEY",
      token: apiKey,
    },
  });

  const publicMock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/public",
    authConfig: { type: "NONE" },
  });

  // Test bearer endpoint
  const bearerResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/bearer-secured",
    { Authorization: `Bearer ${bearerToken}` },
    "",
    [bearerMock],
    []
  );
  assertEqual(
    bearerResult.response.status,
    200,
    "Bearer endpoint should return 200"
  );

  // Test key endpoint
  const keyResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/key-secured",
    { "x-api-key": apiKey },
    "",
    [apiKeyMock],
    []
  );
  assertEqual(
    keyResult.response.status,
    200,
    "API key endpoint should return 200"
  );

  // Test public endpoint
  const publicResult = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/public",
    {},
    "",
    [publicMock],
    []
  );
  assertEqual(
    publicResult.response.status,
    200,
    "Public endpoint should return 200"
  );
});

test("POST request with BEARER_TOKEN auth → 200", () => {
  const validToken = "secret-token";

  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/secure-data",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  const result = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/secure-data",
    {
      Authorization: `Bearer ${validToken}`,
      "Content-Type": "application/json",
    },
    JSON.stringify({ data: "sensitive" }),
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "POST with valid auth should return 200"
  );
});

test("POST request with BEARER_TOKEN auth (missing token) → 401", () => {
  const validToken = "secret-token";

  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/secure-data",
    authConfig: {
      type: "BEARER_TOKEN",
      token: validToken,
    },
  });

  const result = simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/secure-data",
    { "Content-Type": "application/json" },
    JSON.stringify({ data: "sensitive" }),
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    401,
    "POST without auth should return 401"
  );
});

test("DELETE request with API_KEY auth → 200", () => {
  const validKey = "delete-key";

  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/secure/:id",
    authConfig: {
      type: "API_KEY",
      token: validKey,
    },
  });

  const result = simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/secure/123",
    { "x-api-key": validKey },
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "DELETE with valid key should return 200"
  );
});

test("Verify 401 response structure is correct", () => {
  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/secure",
    authConfig: {
      type: "BEARER_TOKEN",
      token: "valid-token",
    },
  });

  const result = simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/secure",
    { Authorization: "Bearer invalid-token" },
    "",
    [mock],
    []
  );

  // Verify response structure
  assertEqual(result.response.status, 401, "Status should be 401");
  const response = JSON.parse(result.response.body);
  assert(response.error !== undefined, "Should have error field");
  assert(response.message !== undefined, "Should have message field");
  assert(result.response.headers.length > 0, "Should have headers");

  const contentTypeHeader = result.response.headers.find(
    (h) => h.key.toLowerCase() === "content-type"
  );
  assert(contentTypeHeader !== undefined, "Should have Content-Type header");
});

// ============================================
// Run All Tests
// ============================================

console.log("\n" + "=".repeat(60));
console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
console.log("=".repeat(60) + "\n");

if (failCount === 0) {
  console.log("✨ All authentication tests passed!");
} else {
  console.log(`⚠️  ${failCount} test(s) failed.`);
}

console.log("\n");

process.exit(failCount === 0 ? 0 : 1);
