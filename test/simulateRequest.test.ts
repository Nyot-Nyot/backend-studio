/**
 * Task 4.2 – Stateful simulateRequest Testing
 *
 * Test all CRUD operations with storeName:
 * - GET (without params): return entire collection
 * - GET (with params): return item by id, or 404
 * - POST: parse JSON body, insert, return item (with validation)
 * - PUT/PATCH: update by id; 404 if not found; 400 if invalid JSON
 * - DELETE: delete by id; 200 if success; 404 if not found
 *
 * All methods return correct status codes & bodies
 */

import { dbService } from "../services/dbService";
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

function assertJsonEqual(actual: string, expected: any, message: string) {
  const parsed = JSON.parse(actual);
  if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
    throw new Error(
      `${message} | Expected: ${JSON.stringify(
        expected
      )}, Got: ${JSON.stringify(parsed)}`
    );
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
    responseBody: "{}",
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

console.log("🧪 Starting Stateful simulateRequest Tests\n");


// ============================================
// GET TESTS
// ============================================

test("GET without params: return entire collection", async () => {
  // Setup: Insert test data
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("users", { id: 2, name: "Bob" });

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/users",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/users",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const items = JSON.parse(result.response.body);
  assertEqual(items.length, 2, "Should return 2 items");
});

test("GET with params: return item by id", async () => {
  // Setup
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("users", { id: 2, name: "Bob" });

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/users/1",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const item = JSON.parse(result.response.body);
  assertEqual(item.id, 1, "Should return item with id 1");
  assertEqual(item.name, "Alice", "Should return correct name");
});

test("GET with params: return 404 if item not found", async () => {
  // No data inserted

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/users/999",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 404, "Status should be 404");
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("GET with string ID in URL, numeric ID in DB", async () => {
  // Setup with numeric ID
  dbService.insert("users", { id: 42, name: "Charlie" });

  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/users/:id",
    storeName: "users",
  });

  // Request with string "42" in URL
  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/users/42",
    {},
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 (loose comparison)"
  );
  const item = JSON.parse(result.response.body);
  assertEqual(item.name, "Charlie", "Should find item with loose comparison");
});

// ============================================
// POST TESTS
// ============================================

test("POST: parse JSON body, insert, return new item", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/users",
    storeName: "users",
  });

  const requestBody = JSON.stringify({
    name: "David",
    email: "david@example.com",
  });

  const result = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    { "Content-Type": "application/json" },
    requestBody,
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const item = JSON.parse(result.response.body);
  assert(item.id !== undefined, "Should have generated ID");
  assertEqual(item.name, "David", "Should have name from request");
  assertEqual(
    item.email,
    "david@example.com",
    "Should have email from request"
  );

  // Verify it's in the collection
  const stored = dbService.find("users", item.id);
  assert(stored !== undefined, "Item should be stored in collection");
});

test("POST: validate JSON body, return 400 if invalid", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/users",
    storeName: "users",
  });

  const invalidJson = "not valid json {]";

  const result = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    { "Content-Type": "application/json" },
    invalidJson,
    [mock],
    []
  );

  assertEqual(result.response.status, 400, "Status should be 400");
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("POST: handle empty body (empty JSON)", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/users",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    { "Content-Type": "application/json" },
    "", // Empty body
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const item = JSON.parse(result.response.body);
  assert(item.id !== undefined, "Should have generated ID");
});

test("POST: multiple items maintain unique IDs", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/users",
    storeName: "users",
  });

  // Create first item
  const result1 = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    {},
    JSON.stringify({ name: "User1" }),
    [mock],
    []
  );
  const item1 = JSON.parse(result1.response.body);
  console.log('DEBUG item1 id:', item1.id);

  // Create second item
  const result2 = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    {},
    JSON.stringify({ name: "User2" }),
    [mock],
    []
  );
  const item2 = JSON.parse(result2.response.body);
  console.log('DEBUG item2 id:', item2.id);

  assert(item1.id !== item2.id, "IDs should be unique");
  assertEqual(item1.name, "User1", "First item name");
  assertEqual(item2.name, "User2", "Second item name");
});

// ============================================
// PUT/PATCH TESTS
// ============================================

test("PUT: update existing item by id", async () => {
  // Setup
  const created = dbService.insert("users", { name: "Eve" });

  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/users/:id",
    storeName: "users",
  });

  const updateBody = JSON.stringify({
    name: "Eve Updated",
    email: "eve@example.com",
  });

  const result = await simulateRequest(
    HttpMethod.PUT,
    `http://api.example.com/api/users/${created.id}`,
    { "Content-Type": "application/json" },
    updateBody,
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const updated = JSON.parse(result.response.body);
  assertEqual(updated.id, created.id, "ID should not change");
  assertEqual(updated.name, "Eve Updated", "Name should be updated");
  assertEqual(updated.email, "eve@example.com", "Email should be added");
});

test("PATCH: update existing item by id", async () => {
  // Setup
  const created = dbService.insert("users", {
    name: "Frank",
    email: "frank@example.com",
  });

  const mock = createMockEndpoint({
    method: HttpMethod.PATCH,
    path: "/api/users/:id",
    storeName: "users",
  });

  const updateBody = JSON.stringify({ name: "Frank Updated" });

  const result = await simulateRequest(
    HttpMethod.PATCH,
    `http://api.example.com/api/users/${created.id}`,
    { "Content-Type": "application/json" },
    updateBody,
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const updated = JSON.parse(result.response.body);
  assertEqual(updated.name, "Frank Updated", "Name should be updated");
  assertEqual(updated.email, "frank@example.com", "Email should persist");
});

test("PUT: return 404 if item not found", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/users/:id",
    storeName: "users",
  });

  const updateBody = JSON.stringify({ name: "Nobody" });

  const result = await simulateRequest(
    HttpMethod.PUT,
    "http://api.example.com/api/users/999",
    { "Content-Type": "application/json" },
    updateBody,
    [mock],
    []
  );

  assertEqual(result.response.status, 404, "Status should be 404");
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("PUT: return 400 if JSON invalid", async () => {
  // Setup
  const created = dbService.insert("users", { name: "Grace" });

  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/users/:id",
    storeName: "users",
  });

  const invalidJson = "{invalid json}";

  const result = await simulateRequest(
    HttpMethod.PUT,
    `http://api.example.com/api/users/${created.id}`,
    { "Content-Type": "application/json" },
    invalidJson,
    [mock],
    []
  );

  assertEqual(result.response.status, 400, "Status should be 400");
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("PUT: return 404 if route doesn't match (missing ID segment)", async () => {
  // Route requires :id parameter, so /api/users without ID won't match
  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/users/:id",
    storeName: "users",
  });

  const updateBody = JSON.stringify({ name: "Someone" });

  const result = await simulateRequest(
    HttpMethod.PUT,
    "http://api.example.com/api/users", // Missing ID segment
    { "Content-Type": "application/json" },
    updateBody,
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    404,
    "Status should be 404 (no matching route)"
  );
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("PUT: update with string ID, numeric ID in DB", async () => {
  // Setup with numeric ID
  const created = dbService.insert("users", { id: 99, name: "Helen" });

  const mock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/users/:id",
    storeName: "users",
  });

  const updateBody = JSON.stringify({ name: "Helen Updated" });

  const result = await simulateRequest(
    HttpMethod.PUT,
    "http://api.example.com/api/users/99", // String "99" in URL
    { "Content-Type": "application/json" },
    updateBody,
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 (loose comparison)"
  );
  const updated = JSON.parse(result.response.body);
  assertEqual(
    updated.name,
    "Helen Updated",
    "Should update with loose comparison"
  );
});

// ============================================
// DELETE TESTS
// ============================================

test("DELETE: remove item by id, return 200 on success", async () => {
  // Setup
  const created = dbService.insert("users", { name: "Ivan" });

  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.DELETE,
    `http://api.example.com/api/users/${created.id}`,
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 200, "Status should be 200");
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should indicate success");

  // Verify it's deleted
  const notFound = dbService.find("users", created.id);
  assert(notFound === undefined, "Item should be deleted from collection");
});

test("DELETE: return 404 if item not found", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/users/999",
    {},
    "",
    [mock],
    []
  );

  assertEqual(result.response.status, 404, "Status should be 404");
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("DELETE: return 404 if route doesn't match (missing ID segment)", async () => {
  // Route requires :id parameter, so /api/users without ID won't match
  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/users", // Missing ID segment
    {},
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    404,
    "Status should be 404 (no matching route)"
  );
  const response = JSON.parse(result.response.body);
  assert(response.error, "Should include error message");
});

test("DELETE: with string ID, numeric ID in DB", async () => {
  // Setup
  const created = dbService.insert("users", { id: 88, name: "Jack" });

  const mock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/users/:id",
    storeName: "users",
  });

  const result = await simulateRequest(
    HttpMethod.DELETE,
    "http://api.example.com/api/users/88", // String "88" in URL
    {},
    "",
    [mock],
    []
  );

  assertEqual(
    result.response.status,
    200,
    "Status should be 200 (loose comparison)"
  );
  const response = JSON.parse(result.response.body);
  assertEqual(response.success, true, "Should indicate success");

  // Verify deletion
  const notFound = dbService.find("users", 88);
  assert(notFound === undefined, "Item should be deleted");
});

// ============================================
// COMPLEX SCENARIOS
// ============================================

test("Full CRUD workflow: POST → GET → PUT → DELETE", async () => {
  const postMock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/items",
    storeName: "items",
  });

  const getMock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/items/:id",
    storeName: "items",
  });

  const putMock = createMockEndpoint({
    method: HttpMethod.PUT,
    path: "/api/items/:id",
    storeName: "items",
  });

  const deleteMock = createMockEndpoint({
    method: HttpMethod.DELETE,
    path: "/api/items/:id",
    storeName: "items",
  });

  // POST: Create item
  const createRes = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/items",
    {},
    JSON.stringify({ name: "Test Item", value: 100 }),
    [postMock],
    []
  );
  assertEqual(createRes.response.status, 200, "Create should return 200");
  const created = JSON.parse(createRes.response.body);
  const itemId = created.id;

  // GET: Retrieve item
  const getRes = await simulateRequest(
    HttpMethod.GET,
    `http://api.example.com/api/items/${itemId}`,
    {},
    "",
    [getMock],
    []
  );
  assertEqual(getRes.response.status, 200, "Get should return 200");
  const retrieved = JSON.parse(getRes.response.body);
  assertEqual(retrieved.name, "Test Item", "Should retrieve same item");

  // PUT: Update item
  const updateRes = await simulateRequest(
    HttpMethod.PUT,
    `http://api.example.com/api/items/${itemId}`,
    {},
    JSON.stringify({ name: "Updated Item", value: 200 }),
    [putMock],
    []
  );
  assertEqual(updateRes.response.status, 200, "Update should return 200");
  const updated = JSON.parse(updateRes.response.body);
  assertEqual(updated.name, "Updated Item", "Should update item");

  // DELETE: Remove item
  const deleteRes = await simulateRequest(
    HttpMethod.DELETE,
    `http://api.example.com/api/items/${itemId}`,
    {},
    "",
    [deleteMock],
    []
  );
  assertEqual(deleteRes.response.status, 200, "Delete should return 200");

  // Verify deleted
  const notFoundRes = await simulateRequest(
    HttpMethod.GET,
    `http://api.example.com/api/items/${itemId}`,
    {},
    "",
    [getMock],
    []
  );
  assertEqual(
    notFoundRes.response.status,
    404,
    "Get should return 404 after delete"
  );
});

test("Multiple simultaneous operations on different collections", async () => {
  const userPostMock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/users",
    storeName: "users",
  });

  const productPostMock = createMockEndpoint({
    method: HttpMethod.POST,
    path: "/api/products",
    storeName: "products",
  });

  // Create user
  const userRes = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/users",
    {},
    JSON.stringify({ name: "UserA" }),
    [userPostMock],
    []
  );
  const user = JSON.parse(userRes.response.body);

  // Create product
  const productRes = await simulateRequest(
    HttpMethod.POST,
    "http://api.example.com/api/products",
    {},
    JSON.stringify({ title: "ProductA" }),
    [productPostMock],
    []
  );
  const product = JSON.parse(productRes.response.body);

  // Verify both exist
  const userCount = dbService.getCollection("users").length;
  const productCount = dbService.getCollection("products").length;

  assertEqual(userCount, 1, "Should have 1 user");
  assertEqual(productCount, 1, "Should have 1 product");
});

test("Status codes and response structure are correct", async () => {
  const mock = createMockEndpoint({
    method: HttpMethod.GET,
    path: "/api/test",
    storeName: "test",
  });

  const result = await simulateRequest(
    HttpMethod.GET,
    "http://api.example.com/api/test",
    {},
    "",
    [mock],
    []
  );

  // Verify response structure
  assert(result.response !== undefined, "Should have response object");
  assert(
    typeof result.response!.status === "number",
    "Should have numeric status"
  );
  assert(typeof result.response!.body === "string", "Should have string body");
  assert(Array.isArray(result.response!.headers), "Should have headers array");
  assert(
    typeof result.response.delay === "number",
    "Should have numeric delay"
  );
});

(async () => {
  await finalizeTests();

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
  console.log("=".repeat(60) + "\n");

  process.exit(failCount === 0 ? 0 : 1);
})();
