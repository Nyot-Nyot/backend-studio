/**
 * Integration Test: dbService CRUD Workflows
 * Task 4.1: E2E verification of dbService operations
 *
 * Real-world scenarios:
 * - User CRUD with auto-increment IDs
 * - Product CRUD with UUID IDs
 * - Mixed operations without data corruption
 */

import { dbService } from "../services/dbService";

// ============================================
// Mock localStorage for testing
// ============================================
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
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

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

// ============================================
// Test Utilities
// ============================================
class TestRunner {
  private scenarios: { name: string; fn: () => Promise<void> | void }[] = [];
  private passCount = 0;
  private failCount = 0;

  scenario(name: string, fn: () => Promise<void> | void) {
    this.scenarios.push({ name, fn });
  }

  async run() {
    console.log("🧪 Starting Integration Test Suite\n");

    for (const { name, fn } of this.scenarios) {
      try {
        mockLocalStorage.clear();
        await fn();
        console.log(`✅ PASS: ${name}`);
        this.passCount++;
      } catch (error: any) {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   ${error.message}\n`);
        this.failCount++;
      }
    }

    console.log(
      `\n📊 Results: ${this.passCount} passed, ${this.failCount} failed of ${this.scenarios.length} scenarios\n`
    );
    return this.failCount === 0;
  }
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

// ============================================
// INTEGRATION TEST SCENARIOS
// ============================================

const runner = new TestRunner();

runner.scenario(
  "Scenario 1: User Management (Numeric Auto-Increment IDs)",
  async () => {
    // Create users
    const user1 = dbService.insert("users", {
      name: "Alice",
      email: "alice@test.com",
    });
    const user2 = dbService.insert("users", {
      name: "Bob",
      email: "bob@test.com",
    });
    const user3 = dbService.insert("users", {
      name: "Charlie",
      email: "charlie@test.com",
    });

    // Verify auto-increment IDs
    assert(typeof user1.id === "number", "User 1 should have numeric ID");
    assert(typeof user2.id === "number", "User 2 should have numeric ID");
    assert(typeof user3.id === "number", "User 3 should have numeric ID");
    assertEqual(user1.id, 1, "First user should have ID 1");
    assertEqual(user2.id, 2, "Second user should have ID 2");
    assertEqual(user3.id, 3, "Third user should have ID 3");

    // Read user
    const found = dbService.find("users", 2);
    assert(found !== undefined, "Should find user");
    assertEqual(found.name, "Bob", "Should find correct user");

    // Update user
    const updated = dbService.update("users", 2, {
      email: "bob.updated@test.com",
    });
    assert(updated !== null, "Should update user");
    assertEqual(
      updated.email,
      "bob.updated@test.com",
      "Email should be updated"
    );

    // Verify persistence
    const refetched = dbService.find("users", 2);
    assertEqual(
      refetched.email,
      "bob.updated@test.com",
      "Update should persist"
    );

    // Delete user
    const deleted = dbService.delete("users", 1);
    assert(deleted === true, "Should delete user");

    // Verify deletion
    const notFound = dbService.find("users", 1);
    assert(notFound === undefined, "Deleted user should not be found");

    // Verify collection state
    const users = dbService.getCollection("users");
    assertEqual(users.length, 2, "Should have 2 users left");
  }
);

runner.scenario("Scenario 2: Product Catalog (UUID String IDs)", async () => {
  // Create products (will use UUID strategy)
  const prod1 = dbService.insert("products", { name: "Laptop", price: 999 });
  const prod2 = dbService.insert("products", { name: "Mouse", price: 25 });
  const prod3 = dbService.insert("products", { name: "Keyboard", price: 75 });

  // Verify UUID IDs
  assert(typeof prod1.id === "string", "Product 1 should have string ID");
  assert(typeof prod2.id === "string", "Product 2 should have string ID");
  assert(prod1.id !== prod2.id, "Each product should have unique ID");

  // Find by string ID
  const found = dbService.find("products", prod1.id);
  assert(found !== undefined, "Should find product by UUID");
  assertEqual(found.name, "Laptop", "Should find correct product");

  // List all products
  const allProducts = dbService.getCollection("products");
  assertEqual(allProducts.length, 3, "Should have 3 products");

  // Update product price
  const updated = dbService.update("products", prod2.id, { price: 30 });
  assert(updated !== null, "Should update product");
  assertEqual(updated.price, 30, "Price should be updated");

  // Delete product
  const deleted = dbService.delete("products", prod3.id);
  assert(deleted === true, "Should delete product");

  const remaining = dbService.getCollection("products");
  assertEqual(remaining.length, 2, "Should have 2 products left");
});

runner.scenario(
  "Scenario 3: Loose ID Comparison (String/Number Mismatch)",
  async () => {
    // Insert with numeric IDs
    dbService.insert("orders", { id: 100, amount: 150 });
    dbService.insert("orders", { id: 101, amount: 200 });

    // Find using string ID
    const byString = dbService.find("orders", "100");
    assert(
      byString !== undefined,
      "Should find by string ID (loose comparison)"
    );
    assertEqual(byString.amount, 150, "Should match correct order");

    // Update using string ID
    const updated = dbService.update("orders", "101", { amount: 250 });
    assert(updated !== null, "Should update with string ID");
    assertEqual(updated.amount, 250, "Update should work with string ID");

    // Delete using string ID
    const deleted = dbService.delete("orders", "100");
    assert(deleted === true, "Should delete with string ID");

    const remaining = dbService.getCollection("orders");
    assertEqual(remaining.length, 1, "Should have 1 order left");
    assertEqual(remaining[0].id, 101, "Remaining order ID should be 101");
  }
);

runner.scenario("Scenario 4: Handling Falsy IDs (ID = 0)", async () => {
  // Insert with ID = 0
  const item1 = dbService.insert("counters", { id: 0, value: 100 });
  assertEqual(item1.id, 0, "Should allow ID 0");

  // Next insert should auto-increment from 0
  const item2 = dbService.insert("counters", { value: 200 });
  assertEqual(item2.id, 1, "Should auto-increment from 0");

  // Find by ID 0
  const found = dbService.find("counters", 0);
  assert(found !== undefined, "Should find by ID 0");
  assertEqual(found.value, 100, "Should find correct item");

  // Update ID 0
  const updated = dbService.update("counters", 0, { value: 150 });
  assert(updated !== null, "Should update ID 0");
  assertEqual(updated.value, 150, "Value should be updated");

  // Delete ID 0
  const deleted = dbService.delete("counters", 0);
  assert(deleted === true, "Should delete ID 0");

  const remaining = dbService.getCollection("counters");
  assertEqual(remaining.length, 1, "Should have 1 item left");
});

runner.scenario("Scenario 5: Complex Multi-Collection Operations", async () => {
  // Create mock e-commerce scenario
  // Users
  const user1 = dbService.insert("users", { name: "Alice" });
  const user2 = dbService.insert("users", { name: "Bob" });

  // Products
  const prod1 = dbService.insert("products", { name: "Laptop", price: 1000 });
  const prod2 = dbService.insert("products", { name: "Mouse", price: 25 });

  // Orders
  const order1 = dbService.insert("orders", {
    userId: user1.id,
    productId: prod1.id,
    quantity: 1,
    total: 1000,
  });
  const order2 = dbService.insert("orders", {
    userId: user2.id,
    productId: prod2.id,
    quantity: 5,
    total: 125,
  });

  // Verify all collections exist
  const collections = dbService.listCollections().sort();
  assert(collections.includes("users"), "Should have users collection");
  assert(collections.includes("products"), "Should have products collection");
  assert(collections.includes("orders"), "Should have orders collection");

  // Verify counts
  assertEqual(
    dbService.getCollection("users").length,
    2,
    "Should have 2 users"
  );
  assertEqual(
    dbService.getCollection("products").length,
    2,
    "Should have 2 products"
  );
  assertEqual(
    dbService.getCollection("orders").length,
    2,
    "Should have 2 orders"
  );

  // Update order status
  dbService.update("orders", order1.id, { status: "shipped" });

  // Delete user and verify referential data exists
  dbService.delete("users", user1.id);
  const updatedOrder = dbService.find("orders", order1.id);
  assert(
    updatedOrder !== undefined,
    "Order should still exist (no cascade delete)"
  );
  assertEqual(updatedOrder.status, "shipped", "Order should retain updates");

  // Final verification
  assertEqual(
    dbService.getCollection("users").length,
    1,
    "Should have 1 user left"
  );
  assertEqual(
    dbService.getCollection("orders").length,
    2,
    "Orders unaffected by user deletion"
  );
});

runner.scenario(
  "Scenario 6: No Data Corruption on Rapid Operations",
  async () => {
    // Rapid inserts
    for (let i = 0; i < 100; i++) {
      dbService.insert("performance", { value: i });
    }

    const afterInserts = dbService.getCollection("performance");
    assertEqual(afterInserts.length, 100, "Should have 100 items");

    // Verify IDs are sequential
    for (let i = 0; i < 100; i++) {
      assert(afterInserts[i].id === i + 1, `Item ${i} should have ID ${i + 1}`);
    }

    // Rapid updates
    for (let i = 1; i <= 50; i++) {
      dbService.update("performance", i, { updated: true });
    }

    const afterUpdates = dbService.getCollection("performance");
    const updatedCount = afterUpdates.filter(
      (item: any) => item.updated
    ).length;
    assertEqual(updatedCount, 50, "Should have 50 updated items");

    // Rapid deletes (every 2nd item)
    for (let i = 2; i <= 100; i += 2) {
      dbService.delete("performance", i);
    }

    const afterDeletes = dbService.getCollection("performance");
    assertEqual(afterDeletes.length, 50, "Should have 50 items left");

    // Verify data integrity (no duplicates)
    const ids = afterDeletes.map((item: any) => item.id);
    const uniqueIds = new Set(ids);
    assertEqual(
      ids.length,
      uniqueIds.size,
      "All IDs should be unique (no duplicates)"
    );
  }
);

runner.scenario("Scenario 7: Collection Stats and Diagnostics", async () => {
  // Numeric ID collection
  dbService.insert("numeric", { id: 1, data: "a" });
  dbService.insert("numeric", { id: 2, data: "b" });

  const numericStats = dbService.getStats("numeric");
  assertEqual(numericStats.count, 2, "Numeric collection should have 2 items");
  assertEqual(numericStats.idType, "numeric", "Should detect numeric IDs");

  // String ID collection
  dbService.insert("strings", { id: "abc", data: "x" });
  dbService.insert("strings", { id: "def", data: "y" });

  const stringStats = dbService.getStats("strings");
  assertEqual(stringStats.count, 2, "String collection should have 2 items");
  assertEqual(stringStats.idType, "string", "Should detect string IDs");

  // Empty collection
  const emptyStats = dbService.getStats("empty");
  assertEqual(emptyStats.count, 0, "Empty collection should have 0 items");
});

// ============================================
// Run All Tests
// ============================================
runner.run().then((success) => {
  process.exit(success ? 0 : 1);
});
