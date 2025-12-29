// SKIPPED: DatabaseView tests removed because the Database page was removed from the UI.
console.log("SKIPPED: DatabaseView tests removed because Database page was removed.");

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================
// TEST SUITE: DatabaseView Functionality
// ============================================

console.log("🧪 Starting DatabaseView Component Tests\n");

test("Setup: Clean database", () => {
  localStorage.clear();
  const collections = dbService.listCollections();
  assertEqual(collections.length, 0, "Database should be empty");
});

// ============================================
// COLLECTION LIST TESTS
// ============================================

test("Collection list: Display collection names from listCollections()", () => {
  localStorage.clear();

  // Create test data in multiple collections
  dbService.insert("users", { name: "Alice" });
  dbService.insert("posts", { title: "Hello" });
  dbService.insert("comments", { text: "Nice!" });

  const collections = dbService.listCollections();

  assertEqual(collections.length, 3, "Should have 3 collections");
  assert(collections.includes("users"), "Should include users collection");
  assert(collections.includes("posts"), "Should include posts collection");
  assert(
    collections.includes("comments"),
    "Should include comments collection"
  );
});

// ============================================
// TABLE DISPLAY TESTS
// ============================================

test("Table display: Show collection contents as items", () => {
  localStorage.clear();

  const items = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ];

  items.forEach((item) => dbService.insert("users", item));

  const collection = dbService.getCollection("users");

  assertEqual(collection.length, 3, "Should have 3 items");
  assertEqual(collection[0].name, "Alice", "First item should be Alice");
  assertEqual(collection[1].name, "Bob", "Second item should be Bob");
  assertEqual(collection[2].name, "Charlie", "Third item should be Charlie");
});

// ============================================
// DELETE PER ITEM TESTS
// ============================================

test("Delete per item: Remove single item by index", () => {
  localStorage.clear();

  // Setup
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("users", { id: 2, name: "Bob" });
  dbService.insert("users", { id: 3, name: "Charlie" });

  let collection = dbService.getCollection("users");
  assertEqual(collection.length, 3, "Should start with 3 items");

  // Delete item at index 1 (Bob)
  const newCollection = collection.filter((_, i) => i !== 1);
  dbService.saveCollection("users", newCollection);

  collection = dbService.getCollection("users");

  assertEqual(collection.length, 2, "Should have 2 items after delete");
  assertEqual(collection[0].name, "Alice", "First item should still be Alice");
  assertEqual(
    collection[1].name,
    "Charlie",
    "Second item should now be Charlie"
  );
});

test("Delete per item: Persists to localStorage", () => {
  localStorage.clear();

  // Setup initial data
  dbService.insert("users", { id: 1, name: "Alice" });
  dbService.insert("users", { id: 2, name: "Bob" });

  // Delete and verify
  let collection = dbService.getCollection("users");
  const filtered = collection.filter((_, i) => i !== 0);
  dbService.saveCollection("users", filtered);

  // Re-read from localStorage to confirm persistence
  const reloaded = dbService.getCollection("users");

  assertEqual(reloaded.length, 1, "Reloaded data should have 1 item");
  assertEqual(reloaded[0].name, "Bob", "Reloaded item should be Bob");
});

test("Delete per item: Multiple deletions maintain order", () => {
  localStorage.clear();

  // Setup
  for (let i = 1; i <= 5; i++) {
    dbService.insert("items", { id: i, value: i * 10 });
  }

  let collection = dbService.getCollection("items");
  assertEqual(collection.length, 5, "Should start with 5 items");

  // Delete items at indices 1 and 3 (values 20 and 40)
  let filtered = collection.filter((_, i) => i !== 1);
  dbService.saveCollection("items", filtered);

  filtered = dbService.getCollection("items").filter((_, i) => i !== 2); // Index 2 after first delete is original index 3
  dbService.saveCollection("items", filtered);

  collection = dbService.getCollection("items");

  assertEqual(collection.length, 3, "Should have 3 items after 2 deletions");
  assertEqual(collection[0].value, 10, "First should be value 10");
  assertEqual(collection[1].value, 30, "Second should be value 30");
  assertEqual(collection[2].value, 50, "Third should be value 50");
});

// ============================================
// CLEAR COLLECTION TESTS
// ============================================

// New tests for DatabaseView helper logic introduced in component

test("Headers: union of keys with id first", () => {
  localStorage.clear();

  const mixed = [
    { id: "a1", name: "A" },
    { title: "T1", description: "D1" },
    { id: 2, email: "e@x" },
  ];

  dbService.saveCollection("mixed", mixed as any);
  const data = dbService.getCollection("mixed") as any[];

  const keys = new Set<string>();
  data.forEach((it) => Object.keys(it || {}).forEach((k) => keys.add(k)));
  const arr = Array.from(keys);
  const headers = arr.includes("id") ? ["id", ...arr.filter((k) => k !== "id").sort()] : arr.sort();

  assert(headers[0] === "id", "id should be first header when present");
  assert(headers.includes("name"), "headers should include name");
  assert(headers.includes("title"), "headers should include title");
  assert(headers.length >= 3, "should have at least 3 headers");
});

test("dbService.delete returns false for missing id", () => {
  localStorage.clear();
  dbService.saveCollection("x", [{ name: "noid" }] as any);
  const result = dbService.delete("x", "does-not-exist");
  assert(result === false, "delete should return false for non-existent id");
});

test("Clear collection: Remove all items from single collection", () => {
  localStorage.clear();

  // Setup with data in multiple collections
  dbService.insert("users", { name: "Alice" });
  dbService.insert("users", { name: "Bob" });
  dbService.insert("posts", { title: "Hello" });

  let userCollection = dbService.getCollection("users");
  let postCollection = dbService.getCollection("posts");

  assertEqual(userCollection.length, 2, "Users should have 2 items");
  assertEqual(postCollection.length, 1, "Posts should have 1 item");

  // Clear users collection
  dbService.clearCollection("users");

  userCollection = dbService.getCollection("users");
  postCollection = dbService.getCollection("posts");

  assertEqual(userCollection.length, 0, "Users should be empty");
  assertEqual(postCollection.length, 1, "Posts should still have 1 item");
});

test("Clear collection: Doesn't affect other collections", () => {
  localStorage.clear();

  // Setup
  dbService.insert("users", { name: "Alice" });
  dbService.insert("posts", { title: "Post 1" });
  dbService.insert("posts", { title: "Post 2" });
  dbService.insert("comments", { text: "Comment 1" });

  // Clear posts
  dbService.clearCollection("posts");

  const users = dbService.getCollection("users");
  const posts = dbService.getCollection("posts");
  const comments = dbService.getCollection("comments");

  assertEqual(users.length, 1, "Users should still have 1 item");
  assertEqual(posts.length, 0, "Posts should be empty");
  assertEqual(comments.length, 1, "Comments should still have 1 item");
});

// ============================================
// CLEAR ALL DB TESTS
// ============================================

test("Clear all DB: Remove all collections", () => {
  localStorage.clear();

  // Setup multiple collections
  dbService.insert("users", { name: "Alice" });
  dbService.insert("posts", { title: "Hello" });
  dbService.insert("comments", { text: "Nice" });

  let collections = dbService.listCollections();
  assert(
    collections.includes("users") && collections.includes("posts") && collections.includes("comments"),
    "Should have the test collections"
  );

  // Clear all
  dbService.clearAllCollections();

  collections = dbService.listCollections();

  assert(
    !collections.includes("users") && !collections.includes("posts") && !collections.includes("comments"),
    "Test collections should be removed after clearAllCollections"
  );
});

test("Clear all DB: Persists to localStorage", () => {
  localStorage.clear();

  // Setup and clear
  dbService.insert("users", { name: "Alice" });
  dbService.insert("posts", { title: "Hello" });
  dbService.clearAllCollections();

  // Verify localStorage is actually empty
  let foundCollections = false;
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("api_sim_db_")) {
      foundCollections = true;
    }
  });

  assert(!foundCollections, "localStorage should have no api_sim_db_ keys");
});

// ============================================
// DATA ISOLATION TESTS
// ============================================

test("Multi-collection isolation: Operations don't cross collections", () => {
  localStorage.clear();

  // Create similar data in multiple collections
  const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  const posts = [
    { id: 1, title: "Post A" },
    { id: 2, title: "Post B" },
  ];

  users.forEach((u) => dbService.insert("users", u));
  posts.forEach((p) => dbService.insert("posts", p));

  // Delete from users
  let userCollection = dbService.getCollection("users");
  let filtered = userCollection.filter((_, i) => i !== 0);
  dbService.saveCollection("users", filtered);

  // Verify posts are unaffected
  const postCollection = dbService.getCollection("posts");

  assertEqual(postCollection.length, 2, "Posts should still have 2 items");
  assertEqual(
    postCollection[0].title,
    "Post A",
    "First post should be unchanged"
  );
  assertEqual(
    postCollection[1].title,
    "Post B",
    "Second post should be unchanged"
  );
});

test("Multi-collection isolation: Clear one doesn't affect others", () => {
  localStorage.clear();

  dbService.insert("collection1", { value: "A" });
  dbService.insert("collection2", { value: "B" });
  dbService.insert("collection3", { value: "C" });

  // Clear collection2
  dbService.clearCollection("collection2");

  const col1 = dbService.getCollection("collection1");
  const col2 = dbService.getCollection("collection2");
  const col3 = dbService.getCollection("collection3");

  assertEqual(col1.length, 1, "Collection 1 should have 1 item");
  assertEqual(col2.length, 0, "Collection 2 should be empty");
  assertEqual(col3.length, 1, "Collection 3 should have 1 item");
});

// ============================================
// TABLE OPERATIONS TESTS
// ============================================

test("Table operations: Delete mixed with other items", () => {
  localStorage.clear();

  const items = [
    { id: 1, name: "Alice", age: 25 },
    { id: 2, name: "Bob", age: 30 },
    { id: 3, name: "Charlie", age: 35 },
    { id: 4, name: "Diana", age: 28 },
  ];

  items.forEach((item) => dbService.insert("users", item));

  // Delete items at indices 1 and 3 (Bob and Diana)
  let collection = dbService.getCollection("users");
  collection = collection.filter((_, i) => i !== 3);
  dbService.saveCollection("users", collection);

  collection = dbService.getCollection("users");
  collection = collection.filter((_, i) => i !== 1);
  dbService.saveCollection("users", collection);

  collection = dbService.getCollection("users");

  assertEqual(collection.length, 2, "Should have 2 items");
  assertEqual(collection[0].name, "Alice", "First should be Alice");
  assertEqual(collection[1].name, "Charlie", "Second should be Charlie");
});

test("Table operations: Clear collection via clear button", () => {
  localStorage.clear();

  // Simulate user adding data and then clicking clear
  dbService.insert("testdata", { item: 1 });
  dbService.insert("testdata", { item: 2 });
  dbService.insert("testdata", { item: 3 });

  assertEqual(
    dbService.getCollection("testdata").length,
    3,
    "Should have 3 items"
  );

  // User clicks "Clear collection" button
  dbService.clearCollection("testdata");

  assertEqual(
    dbService.getCollection("testdata").length,
    0,
    "Should be empty after clear"
  );
});

// ============================================
// ACCEPTANCE TESTS
// ============================================

test("Acceptance: Changes reflected in localStorage", () => {
  localStorage.clear();

  // Create item
  dbService.insert("users", { name: "Alice" });

  // Verify in localStorage
  const stored = localStorage.getItem("api_sim_db_users");
  assert(stored !== null, "Data should be in localStorage");

  const parsed = JSON.parse(stored!);
  assertEqual(parsed.length, 1, "Should have 1 item in localStorage");
  assertEqual(parsed[0].name, "Alice", "Item name should be in localStorage");
});

test("Acceptance: Operations don't affect other collections", () => {
  localStorage.clear();

  // Setup 3 collections
  dbService.insert("users", { id: 1 });
  dbService.insert("users", { id: 2 });

  dbService.insert("posts", { id: 1 });
  dbService.insert("posts", { id: 2 });

  dbService.insert("tags", { id: 1 });

  // Delete from users
  let users = dbService.getCollection("users");
  dbService.saveCollection(
    "users",
    users.filter((_, i) => i !== 0)
  );

  // Verify only users changed
  users = dbService.getCollection("users");
  const posts = dbService.getCollection("posts");
  const tags = dbService.getCollection("tags");

  assertEqual(users.length, 1, "Users should have 1 item");
  assertEqual(posts.length, 2, "Posts should still have 2 items");
  assertEqual(tags.length, 1, "Tags should still have 1 item");
});

test("Acceptance: Full CRUD cycle with DatabaseView operations", () => {
  localStorage.clear();

  // Create
  dbService.insert("users", {
    id: 1,
    name: "Alice"
  });
  dbService.insert("users", { id: 2, name: "Bob" });
  dbService.insert("users", {
    id: 3,
    name: "Charlie"
  });

  let users = dbService.getCollection("users");
  assertEqual(users.length, 3, "Should have 3 users");

  // Delete one (simulating table delete button)
  users = users.filter((_, i) => i !== 1);
  dbService.saveCollection("users", users);

  users = dbService.getCollection("users");
  assertEqual(users.length, 2, "Should have 2 users after delete");

  // Update through new save (simulating JSON edit)
  users[0].name = "Alice Updated";
  dbService.saveCollection("users", users);

  users = dbService.getCollection("users");
  assertEqual(users[0].name, "Alice Updated", "Should reflect update");

  // Clear collection (simulating clear button)
  dbService.clearCollection("users");

  users = dbService.getCollection("users");
  assertEqual(users.length, 0, "Should be empty after clear");
});

console.log("\n============================================================");
console.log("📊 All DatabaseView tests completed");
console.log("============================================================");
