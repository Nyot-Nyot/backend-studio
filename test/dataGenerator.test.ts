import { generateRecords } from "../services/dataGenerator";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

console.log("🧪 Starting dataGenerator tests\n");

const schema = {
  id: "users-schema",
  name: "users",
  fields: [
    { name: "id", type: "string", generator: "uuid" },
    { name: "name", type: "string", generator: "randomName" },
    { name: "email", type: "string", generator: "email" },
    { name: "createdAt", type: "date", generator: "isoDate" },
  ],
};

test("generateRecords returns requested number of items", () => {
  const res = generateRecords(schema as any, 5);
  assert(Array.isArray(res), "Result should be an array");
  assert(res.length === 5, "Should generate 5 records");
});

test("generated records contain fields with values", () => {
  const res = generateRecords(schema as any, 1);
  const item = res[0];
  assert(typeof item.id === "string" && item.id.length > 0, "id should be a string");
  assert(typeof item.name === "string", "name should be a string");
  assert(typeof item.email === "string", "email should be a string");
  assert(typeof item.createdAt === "string", "createdAt should be a string");
});
