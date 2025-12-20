/**
 * dbService CRUD Test Suite
 * Task 4.1: Verify & strengthen dbService
 *
 * Tests for:
 * - getCollection, insert, update, delete operations
 * - Auto-ID generation (numeric auto-increment vs UUID)
 * - ID type handling with loose comparison (== vs ===)
 * - Data consistency in LocalStorage
 * - No duplicates or data corruption
 */

import { dbService } from "../services/dbService";

// Mock localStorage for testing
let localStorageData: { [key: string]: string } = {};

const mockLocalStorage = {
  getItem: (key: string) => localStorageData[key] || null,
  setItem: (key: string, value: string) => {
    localStorageData[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete localStorageData[key];
  },
  clear: () => {
    localStorageData = {};
  },
  get length() {
    return Object.keys(localStorageData).length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageData);
    return keys[index] || null;
  },
} as any;

// Intercept Object.keys to work with our mock
const originalObjectKeys = Object.keys;
Object.keys = function (obj: any) {
  if (obj === mockLocalStorage) {
    return originalObjectKeys(localStorageData);
  }
  return originalObjectKeys(obj);
} as any;

// Replace global localStorage with mock
Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto.randomUUID if not available
if (!global.crypto) {
  (global as any).crypto = {};
}
if (!global.crypto.randomUUID) {
  (global.crypto as any).randomUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  };
}

// Test Suite
const tests: { name: string; fn: () => void | Promise<void> }[] = [];
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected && actual != expected) {
    throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
  }
}

async function runTests() {
  console.log("🧪 Starting dbService CRUD Test Suite\n");

  for (const { name, fn } of tests) {
    try {
      // Clear localStorage before each test
      mockLocalStorage.clear();

      await fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (error: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${error.message}\n`);
      failCount++;
    }
  }

  console.log(
    `\n📊 Test Results: ${passCount} passed, ${failCount} failed out of ${tests.length} tests`
  );
  return failCount === 0;
}

// ============================================
// TEST CASES
// ============================================

test("getCollection returns empty array for non-existent collection", () => {
  const result = dbService.getCollection("non_existent");
  assert(Array.isArray(result), "Should return an array");
  assertEqual(result.length, 0, "Should return empty array");
});

test("getCollection returns existing data", () => {
  dbService.insert("users", { name: "Alice" });
  const result = dbService.getCollection("users");
  assertEqual(result.length, 1, "Should contain 1 item");
  assertEqual(result[0].name, "Alice", "Should contain correct data");
});

test("insert generates numeric ID with empty collection", () => {
  const item = dbService.insert("products", { name: "Product 1" });
  assert(item.id !== undefined, "First insert should generate ID");
  assert(typeof item.id === "number", "Should generate numeric ID by default");
  assertEqual(item.id, 1, "First generated ID should be 1");
});

test("insert with numeric IDs uses auto-increment strategy", () => {
  // Insert with numeric IDs first
  dbService.insert("orders", { id: 1, name: "Order 1" });
  dbService.insert("orders", { id: 2, name: "Order 2" });

  // Insert without ID should auto-increment
  const item = dbService.insert("orders", { name: "Order 3" });
  assertEqual(item.id, 3, "Should auto-increment to 3");
});

test("insert with UUID strategy when no numeric IDs", () => {
  // Insert with UUID IDs first
  dbService.insert("items", { id: "abc123", name: "Item 1" });
  dbService.insert("items", { id: "def456", name: "Item 2" });

  // Insert without ID should use UUID strategy
  const item = dbService.insert("items", { name: "Item 3" });
  assert(typeof item.id === "string", "Should generate string UUID");
  assert(
    item.id.length === 8,
    "UUID should be short (8 chars from first segment)"
  );
});

test("insert allows ID 0 (falsy but valid)", () => {
  const item = dbService.insert("counters", { id: 0, value: 100 });
  assertEqual(item.id, 0, "Should allow ID 0");
});

test("insert preserves provided ID", () => {
  const item = dbService.insert("users", { id: 999, name: "Bob" });
  assertEqual(item.id, 999, "Should preserve provided ID");
});

test("find with loose comparison (string vs number ID)", () => {
  dbService.insert("records", { id: 123, data: "test" });

  // Find with number should match string ID
  const resultNum = dbService.find("records", 123);
  assert(resultNum !== undefined, "Should find by number ID");

  // Find with string should match number ID
  const resultStr = dbService.find("records", "123");
  assert(
    resultStr !== undefined,
    "Should find by string ID (loose comparison)"
  );
  assertEqual(resultNum?.id, resultStr?.id, "Both should find same item");
});

test("find returns undefined for non-existent ID", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  const result = dbService.find("users", 999);
  assert(result === undefined, "Should return undefined for non-existent ID");
});

test("update modifies existing item", () => {
  const original = dbService.insert("users", { id: 1, name: "Alice", age: 25 });
  const updated = dbService.update("users", 1, { age: 26 });

  assert(updated !== null, "Should return updated item");
  assertEqual(updated?.id, 1, "ID should not change");
  assertEqual(updated?.name, "Alice", "Other fields should persist");
  assertEqual(updated?.age, 26, "Updated field should change");
});

test("update with loose comparison (string vs number ID)", () => {
  dbService.insert("records", { id: 42, value: "original" });

  // Update with string ID matching number ID
  const updated = dbService.update("records", "42", { value: "modified" });
  assert(updated !== null, "Should update with string ID");
  assertEqual(updated?.value, "modified", "Should modify value");
});

test("update returns null for non-existent ID", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  const result = dbService.update("users", 999, { name: "Bob" });
  assert(result === null, "Should return null for non-existent ID");
});

test("update persists to localStorage", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.update("users", 1, { name: "Alicia" });

  const collection = dbService.getCollection("users");
  assertEqual(
    collection[0].name,
    "Alicia",
    "Update should persist in localStorage"
  );
});

test("delete removes existing item", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("users", { id: 2, name: "Bob" });

  const result = dbService.delete("users", 1);
  assert(result === true, "Should return true for successful delete");

  const collection = dbService.getCollection("users");
  assertEqual(collection.length, 1, "Collection should have 1 item left");
  assertEqual(collection[0].id, 2, "Remaining item should be Bob");
});

test("delete with loose comparison (string vs number ID)", () => {
  dbService.insert("records", { id: 77, name: "Item 1" });
  dbService.insert("records", { id: 88, name: "Item 2" });

  // Delete with string ID matching number ID
  const result = dbService.delete("records", "77");
  assert(result === true, "Should delete with string ID");

  const collection = dbService.getCollection("records");
  assertEqual(collection.length, 1, "Collection should have 1 item left");
  assertEqual(collection[0].id, 88, "Remaining item should be Item 2");
});

test("delete returns false for non-existent ID", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  const result = dbService.delete("users", 999);
  assert(result === false, "Should return false for non-existent ID");
});

test("CRUD workflow: insert → read → update → delete", () => {
  // Insert
  const inserted = dbService.insert("workflow", { name: "Test" });
  assert(inserted.id !== undefined, "Should have generated ID");
  const id = inserted.id;

  // Read
  const found = dbService.find("workflow", id);
  assert(found !== null, "Should find inserted item");
  assertEqual(found?.name, "Test", "Data should match");

  // Update
  const updated = dbService.update("workflow", id, { name: "Updated Test" });
  assert(updated !== null, "Should update item");
  assertEqual(updated?.name, "Updated Test", "Name should be updated");

  // Verify update persisted
  const refetched = dbService.find("workflow", id);
  assertEqual(refetched?.name, "Updated Test", "Update should persist");

  // Delete
  const deleted = dbService.delete("workflow", id);
  assert(deleted === true, "Should delete item");

  // Verify deletion
  const notFound = dbService.find("workflow", id);
  assert(notFound === undefined, "Deleted item should not be found");
});

test("clearCollection removes entire collection", () => {
  dbService.insert("temp", { id: 1, data: "test" });
  dbService.insert("temp", { id: 2, data: "test2" });

  dbService.clearCollection("temp");

  const collection = dbService.getCollection("temp");
  assertEqual(collection.length, 0, "Collection should be empty");
});

test("listCollections returns all active collections", () => {
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("products", { id: 1, name: "Product" });
  dbService.insert("orders", { id: 1, amount: 100 });

  const collections = dbService.listCollections();
  assert(collections.includes("users"), "Should list users collection");
  assert(collections.includes("products"), "Should list products collection");
  assert(collections.includes("orders"), "Should list orders collection");
});

test("no duplicate IDs when inserting multiple items", () => {
  dbService.insert("items", { id: 1, name: "Item 1" });
  dbService.insert("items", { id: 2, name: "Item 2" });
  dbService.insert("items", { id: 3, name: "Item 3" });

  const collection = dbService.getCollection("items");
  const ids = collection.map((item) => item.id);
  const uniqueIds = new Set(ids);

  assertEqual(ids.length, uniqueIds.size, "All IDs should be unique");
});

test("no data corruption on concurrent operations", () => {
  // Simulate concurrent operations
  dbService.insert("concurrent", { id: 1, value: "A" });
  dbService.insert("concurrent", { id: 2, value: "B" });
  dbService.update("concurrent", 1, { value: "A_modified" });
  dbService.insert("concurrent", { id: 3, value: "C" });
  dbService.delete("concurrent", 2);
  dbService.update("concurrent", 3, { value: "C_modified" });

  const collection = dbService.getCollection("concurrent");
  assertEqual(collection.length, 2, "Should have 2 items (1 deleted)");

  const item1 = collection.find((i: any) => i.id === 1);
  const item3 = collection.find((i: any) => i.id === 3);

  assertEqual(item1?.value, "A_modified", "Item 1 should be modified");
  assertEqual(item3?.value, "C_modified", "Item 3 should be modified");
  assert(!collection.find((i: any) => i.id === 2), "Item 2 should be deleted");
});

test("localStorage persistence across collection accesses", () => {
  // Insert into collection
  dbService.insert("persistent", { id: 1, name: "Test" });

  // Simulate fresh access (new dbService instance would read from localStorage)
  const collection = dbService.getCollection("persistent");
  assertEqual(collection.length, 1, "Should persist in localStorage");
  assertEqual(collection[0].name, "Test", "Data should be intact");
});

test("handle mixed ID types gracefully", () => {
  // Mix of numeric and string IDs
  dbService.insert("mixed", { id: 1, type: "number" });
  dbService.insert("mixed", { id: "abc", type: "string" });

  // Should find both
  const byNum = dbService.find("mixed", 1);
  const byStr = dbService.find("mixed", "abc");

  assert(byNum !== undefined, "Should find numeric ID");
  assert(byStr !== undefined, "Should find string ID");
  assertEqual(byNum?.type, "number", "Numeric ID item correct");
  assertEqual(byStr?.type, "string", "String ID item correct");
});

// Run all tests
runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
