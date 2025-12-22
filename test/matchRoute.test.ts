import { matchRoute } from "../services/mockEngine";

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
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
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected && actual != expected) {
    throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
  }
}

console.log("🧪 Starting matchRoute Tests\n");

// Exact param match
test("Exact param match /api/users/:id -> /api/users/123", async () => {
  const r = matchRoute("/api/users/:id", "/api/users/123");
  assert(r.matches, "Should match");
  assertEqual(r.params.id, "123", "Should capture id param");
});

// Optional param: pattern with :id? matches without id
test("Optional param /api/users/:id? -> /api/users", async () => {
  const r = matchRoute("/api/users/:id?", "/api/users");
  assert(r.matches, "Should match when optional param missing");
  assertEqual(r.params.id, undefined, "Param should be undefined when missing");
});

test("Optional param /api/users/:id? -> /api/users/123", async () => {
  const r = matchRoute("/api/users/:id?", "/api/users/123");
  assert(r.matches, "Should match when optional param present");
  assertEqual(r.params.id, "123", "Param should capture value when present");
});

// Single-segment wildcard
test("Single-segment wildcard /api/files/* -> /api/files/readme", async () => {
  const r = matchRoute("/api/files/*", "/api/files/readme");
  assert(r.matches, "Should match single wildcard segment");
});

// Multi-segment wildcard at end should match remaining path
test("Trailing wildcard /api/files/* -> /api/files/docs/readme", async () => {
  const r = matchRoute("/api/files/*", "/api/files/docs/readme");
  assert(r.matches, "Trailing wildcard should match multiple segments");
});

// Mismatch case
test("Mismatch /api/users/:id -> /api/products/1 should not match", async () => {
  const r = matchRoute("/api/users/:id", "/api/products/1");
  assert(!r.matches, "Should not match different root");
});

console.log(`\nTests run: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);

if (failCount > 0) process.exit(1); else process.exit(0);
