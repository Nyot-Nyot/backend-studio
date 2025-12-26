import { formatAuthPreview } from "../services/authUtils";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) throw new Error(`${message} | Expected: ${expected}, Got: ${actual}`);
}

console.log("🧪 Starting Auth UI Preview tests\n");

test("formatAuthPreview - NONE returns Public", () => {
  const res = formatAuthPreview({ type: "NONE" });
  assertEqual(res, "Public", "NONE should return Public");
});

test("formatAuthPreview - BEARER_TOKEN returns Authorization header (masked)", () => {
  const res = formatAuthPreview({ type: "BEARER_TOKEN", token: "abc" });
  assertEqual(res, "Authorization: Bearer ***", "Bearer token masked format");
});

test("formatAuthPreview - API_KEY returns custom header format (masked)", () => {
  const res = formatAuthPreview({ type: "API_KEY", headerKey: "x-api-key", token: "key123" });
  assertEqual(res, "x-api-key: ***", "API Key masked format");
});

console.log("\n🧪 Auth UI Preview tests completed\n");
