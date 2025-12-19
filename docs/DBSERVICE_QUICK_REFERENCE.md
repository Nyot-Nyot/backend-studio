# dbService Quick Reference & Best Practices

## Task 4.1 – Reference Guide for Developers

### 🎯 One-Minute Overview

dbService is a lightweight localStorage-backed database for mock data. It handles CRUD operations, auto-generates IDs, and maintains data integrity.

```typescript
import { dbService } from "../services/dbService";

// CREATE
const item = dbService.insert("items", { name: "Widget" });
// { id: 1, name: 'Widget' }

// READ
const found = dbService.find("items", 1);
// { id: 1, name: 'Widget' }

// UPDATE
dbService.update("items", 1, { name: "Updated Widget" });
// { id: 1, name: 'Updated Widget' }

// DELETE
dbService.delete("items", 1);
// true
```

---

### 📚 Complete API Reference

#### Collection Operations

**getCollection(name: string): any[]**

```typescript
// Get all items from a collection
const items = dbService.getCollection("users");
// Returns: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
// Returns: [] if collection doesn't exist
```

**clearCollection(name: string): void**

```typescript
// Delete entire collection
dbService.clearCollection("users");
// localStorage key 'api_sim_db_users' is removed
```

**listCollections(): string[]**

```typescript
// List all collections
const collections = dbService.listCollections();
// Returns: ['users', 'products', 'orders']
```

**getStats(collection: string): { count: number; idType: 'numeric' | 'string' | 'mixed' }**

```typescript
// Get collection statistics
const stats = dbService.getStats("users");
// Returns: { count: 5, idType: 'numeric' }
```

#### CRUD Operations

**insert(collection: string, item: any): any**

```typescript
// Create new item (auto-generates ID if missing)
const user1 = dbService.insert("users", { name: "Alice" });
// Returns: { id: 1, name: 'Alice' } (numeric auto-increment)

const user2 = dbService.insert("users", { name: "Bob" });
// Returns: { id: 2, name: 'Bob' } (auto-incremented)

// Or provide your own ID
const user3 = dbService.insert("users", { id: 999, name: "Charlie" });
// Returns: { id: 999, name: 'Charlie' } (uses provided ID)

// UUID strategy if not numeric
const item = dbService.insert("products", { name: "Widget" });
// Returns: { id: 'a1b2c3d4', name: 'Widget' } (UUID)
```

**find(collection: string, id: string | number): any | undefined**

```typescript
// Find item by ID (loose comparison)
const item = dbService.find("users", 1);
// Returns: { id: 1, name: 'Alice' }

// Works with string ID too (loose comparison!)
const same = dbService.find("users", "1");
// Returns: { id: 1, name: 'Alice' } (same result!)

// Returns undefined if not found
const notFound = dbService.find("users", 999);
// Returns: undefined
```

**update(collection: string, id: string | number, updates: any): any | null**

```typescript
// Modify existing item
const updated = dbService.update("users", 1, { email: "alice@test.com" });
// Returns: { id: 1, name: 'Alice', email: 'alice@test.com' }

// Works with string ID (loose comparison)
const updated2 = dbService.update("users", "1", { age: 25 });
// Returns: { id: 1, name: 'Alice', email: '...', age: 25 }

// Returns null if not found
const notFound = dbService.update("users", 999, { name: "Nobody" });
// Returns: null
```

**delete(collection: string, id: string | number): boolean**

```typescript
// Remove item by ID
const deleted = dbService.delete("users", 1);
// Returns: true (item was deleted)

// Works with string ID (loose comparison)
const deleted2 = dbService.delete("users", "2");
// Returns: true

// Returns false if not found
const notFound = dbService.delete("users", 999);
// Returns: false
```

---

### 🔄 Auto-ID Strategies

#### Strategy 1: Numeric Auto-Increment

**When**: All existing IDs in collection are `typeof number`

```typescript
// Setup numeric collection
dbService.insert("orders", { id: 1, amount: 100 });
dbService.insert("orders", { id: 2, amount: 200 });

// New inserts will auto-increment
const order3 = dbService.insert("orders", { amount: 300 });
// Returns: { id: 3, amount: 300 } (auto-incremented)

const order4 = dbService.insert("orders", { amount: 400 });
// Returns: { id: 4, amount: 400 } (continues incrementing)

// Even ID 0 works
const order0 = dbService.insert("numbers", { id: 0, value: "zero" });
const order1 = dbService.insert("numbers", { value: "one" });
// Returns: { id: 1, value: 'one' } (increments from 0)
```

#### Strategy 2: Short UUID

**When**: All existing IDs are strings, or collection is empty

```typescript
// UUID generation (first time)
const item1 = dbService.insert("products", { name: "Laptop" });
// Returns: { id: 'a1b2c3d4', name: 'Laptop' } (short UUID)

const item2 = dbService.insert("products", { name: "Mouse" });
// Returns: { id: 'x9y8z7w6', name: 'Mouse' } (another UUID)

// Each ID is unique
console.log(item1.id !== item2.id); // true

// You can also provide your own UUID
const item3 = dbService.insert("products", {
  id: "custom-id",
  name: "Keyboard",
});
// Returns: { id: 'custom-id', name: 'Keyboard' }
```

#### Mixed Scenarios

```typescript
// Start with string IDs → stays UUID
dbService.insert("items", { id: "first", value: 1 });
const item = dbService.insert("items", { value: 2 });
// Returns: { id: 'abc123', value: 2 } (UUID, not numeric)

// Start empty → can be either
const numeric = dbService.insert("collection1", { id: 1, value: "a" });
const next = dbService.insert("collection1", { value: "b" });
// Returns: { id: 2, value: 'b' } (numeric strategy)

// If you mix types, UUID strategy is used
dbService.insert("mixed", { id: "abc" });
dbService.insert("mixed", { id: 123 });
const item = dbService.insert("mixed", { name: "item" });
// Returns: { id: 'xyz123', name: 'item' } (mixed = UUID strategy)
```

---

### 💡 Best Practices

#### 1. **Choose ID Strategy Upfront**

```typescript
// ✅ GOOD: Consistent strategy
dbService.insert("users", { id: 1, name: "Alice" });
dbService.insert("users", { id: 2, name: "Bob" });
// New inserts auto-increment

// ❌ AVOID: Inconsistent IDs
dbService.insert("mixed", { id: 1, name: "Alice" });
dbService.insert("mixed", { id: "uuid-123", name: "Bob" });
// This will trigger UUID strategy, confusion likely
```

#### 2. **Use Loose Comparison Advantage**

```typescript
// ✅ GOOD: Works with any ID type
const userId = "123"; // From URL or form
const user = dbService.find("users", userId);
// Works even if stored ID is numeric!

// ✅ GOOD: No casting needed
const id = getQueryParam("id"); // Could be string or number
dbService.update("users", id, { status: "active" });
// Loose comparison handles both cases
```

#### 3. **Always Check Update/Delete Results**

```typescript
// ✅ GOOD: Check for success
const updated = dbService.update("users", 1, { name: "Alice" });
if (updated) {
  console.log("Updated:", updated);
} else {
  console.log("User not found");
}

const deleted = dbService.delete("users", 1);
if (deleted) {
  console.log("Deleted successfully");
} else {
  console.log("Item not found (already deleted?)");
}

// ❌ AVOID: Assuming success
dbService.update("users", 999, { name: "Nobody" }); // Returns null!
```

#### 4. **Batch Operations Using getCollection**

```typescript
// ✅ GOOD: Get all, filter, update
const users = dbService.getCollection("users");
const admins = users.filter((u) => u.role === "admin");
admins.forEach((admin) => {
  dbService.update("users", admin.id, { lastLogin: Date.now() });
});

// ✅ GOOD: Count items
const count = dbService.getCollection("orders").length;
console.log(`Total orders: ${count}`);

// ✅ GOOD: Find multiple items
const users = dbService.getCollection("users");
const inactiveUsers = users.filter((u) => !u.isActive);
```

#### 5. **Handle Edge Cases**

```typescript
// ✅ GOOD: Handle empty collections
const items = dbService.getCollection("items");
if (items.length === 0) {
  console.log("Collection is empty");
}

// ✅ GOOD: Handle not found
const user = dbService.find("users", 999);
if (!user) {
  console.log("User not found");
}

// ✅ GOOD: Handle falsy IDs
const item = dbService.insert("counters", { id: 0, count: 0 });
console.log(item.id === 0); // true (not undefined/null!)
```

---

### ⚙️ Configuration & Debugging

#### localStorage Key Format

Data is stored with prefix `api_sim_db_`:

```typescript
// Collection 'users' → stored as 'api_sim_db_users'
dbService.insert("users", { id: 1, name: "Alice" });
localStorage.getItem("api_sim_db_users");
// Returns: '[{"id":1,"name":"Alice"}]'

// Collection 'products' → stored as 'api_sim_db_products'
localStorage.getItem("api_sim_db_products");
```

#### Manual localStorage Inspection

```typescript
// View all dbService collections
Object.keys(localStorage).filter((k) => k.startsWith("api_sim_db_"));
// Example: ['api_sim_db_users', 'api_sim_db_products', 'api_sim_db_orders']

// View raw data
const raw = localStorage.getItem("api_sim_db_users");
const parsed = JSON.parse(raw);
console.log(parsed);
```

#### Collection Statistics

```typescript
// Get collection info
const stats = dbService.getStats("users");
console.log(stats);
// { count: 5, idType: 'numeric' }

// Use for debugging
const collections = dbService.listCollections();
collections.forEach((name) => {
  const stats = dbService.getStats(name);
  console.log(`${name}: ${stats.count} items (${stats.idType} IDs)`);
});
// Output:
// users: 5 items (numeric IDs)
// products: 3 items (string IDs)
// orders: 2 items (numeric IDs)
```

---

### ⚠️ Limitations & Considerations

| Limitation            | Impact                      | Workaround                               |
| --------------------- | --------------------------- | ---------------------------------------- |
| ~5-10MB storage limit | Can't store huge datasets   | Paginate or use server                   |
| No querying/filtering | Must fetch all + filter     | Use getCollection() + filter             |
| No indexing           | Slow on large collections   | Keep collections < 1000 items            |
| No transactions       | Multi-collection ops unsafe | Use carefully, implement app-level logic |
| Client-side only      | Not persistent              | Don't use for real data                  |
| No validation         | Bad data can be stored      | Validate before insert/update            |

---

### 🧪 Testing Your Usage

```typescript
import { dbService } from "../services/dbService";

// Test: Insert and retrieve
const inserted = dbService.insert("test", { data: "value" });
console.assert(inserted.id !== undefined, "Should have ID");

// Test: Loose comparison
const found = dbService.find("test", String(inserted.id));
console.assert(found !== undefined, "Should find with string ID");

// Test: Update
const updated = dbService.update("test", inserted.id, { data: "modified" });
console.assert(updated?.data === "modified", "Should update");

// Test: Delete
const deleted = dbService.delete("test", inserted.id);
console.assert(deleted === true, "Should delete");
console.assert(
  !dbService.find("test", inserted.id),
  "Should not find after delete"
);

console.log("✅ All assertions passed!");
```

---

### 🔗 Related Documentation

- [dbService Verification](./DBSERVICE_VERIFICATION.md) – Full technical details
- [Test Execution Guide](./TASK_4_1_TEST_GUIDE.md) – How to run tests
- [Task Completion Summary](./TASK_4_1_COMPLETION.md) – What was implemented

---

### 💬 Common Questions

**Q: When should I use numeric vs UUID?**  
A: Use numeric for sequential data (users, orders). Use UUID for unique identifiers (sessions, tokens).

**Q: Can I mix string and numeric IDs?**  
A: Technically yes, but it triggers UUID strategy. Keep IDs consistent per collection.

**Q: What happens if I don't provide an ID?**  
A: dbService auto-generates one (numeric or UUID based on existing data).

**Q: Is the loose comparison safe?**  
A: Yes! It's intentional. `123 == "123"` is true, preventing type-related bugs.

**Q: How much data can I store?**  
A: Depends on browser, typically 5-10MB. Avoid storing large objects.

**Q: Is data persistent across browser sessions?**  
A: Yes! localStorage persists until manually cleared or storage quota exceeded.

**Q: Can multiple collections share IDs?**  
A: Yes! Each collection has independent ID strategy and data.

---

**Last Updated**: December 19, 2025  
**Version**: 1.0  
**Status**: ✅ Production Ready
