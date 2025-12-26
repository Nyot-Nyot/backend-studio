import { patternsConflict } from "../services/mockEngine";

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

console.log("🧪 Starting routeConflict Tests\n");

test("Param vs literal conflict: /api/users/:id vs /api/users/me", async () => {
  const r = patternsConflict("/api/users/:id", "/api/users/me");
  assert(r, "Should detect conflict because ':id' can be 'me'");
});

test("Param vs param: /api/users/:id vs /api/users/:userId", async () => {
  const r = patternsConflict("/api/users/:id", "/api/users/:userId");
  assert(r, "Two params overlap for same position");
});

test("Wildcard vs concrete path: /api/files/* vs /api/files/docs/readme", async () => {
  const r = patternsConflict("/api/files/*", "/api/files/docs/readme");
  assert(r, "Trailing wildcard overlaps concrete path");
});

test("Optional param conflict: /api/users vs /api/users/:id?", async () => {
  const r = patternsConflict("/api/users", "/api/users/:id?");
  assert(r, "Optional param makes base path match both patterns");
});

test("No conflict when paths are distinct: /api/users vs /api/users/:id", async () => {
  const r = patternsConflict("/api/users", "/api/users/:id");
  assert(!r, "Should not conflict when one requires extra segment and other does not accept it");
});

console.log(`\nTests run: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
if (failCount > 0) process.exit(1); else process.exit(0);
