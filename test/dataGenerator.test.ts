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

// --- New tests for deterministic & nested generation ---

test("deterministic seed produces same output", () => {
  const schemaS = schema as any;
  const a = generateRecords(schemaS, 3, { seed: "my-seed" });
  const b = generateRecords(schemaS, 3, { seed: "my-seed" });
  assert(JSON.stringify(a) === JSON.stringify(b), "Outputs should be identical with same seed");
});

test("nested object generation works via nestedSchemaId", () => {
  const profile = { id: "profile-schema", name: "profile", fields: [{ name: "bio", type: "string" }] };
  const userWithProfile = {
    id: "user-with-profile",
    name: "users",
    fields: [
      { name: "id", type: "string", generator: "uuid" },
      { name: "profile", type: "object", nestedSchemaId: "profile-schema" },
    ],
  };

  const res = generateRecords(userWithProfile as any, 1, { schemaMap: { "profile-schema": profile as any }, seed: "s" });
  const item = res[0];
  assert(item.profile && typeof item.profile === "object", "profile should be an object");
  assert(typeof item.profile.bio === "string", "profile.bio should be a string");
});

test("nested array generation works via nestedSchemaId", () => {
  const post = {
    id: "post-schema",
    name: "posts",
    fields: [{ name: "title", type: "string" }, { name: "views", type: "number" }],
  };
  const userWithPosts = {
    id: "user-with-posts",
    name: "users",
    fields: [
      { name: "id", type: "string", generator: "uuid" },
      { name: "posts", type: "array", nestedSchemaId: "post-schema" },
    ],
  };

  const res = generateRecords(userWithPosts as any, 2, { schemaMap: { "post-schema": post as any }, seed: 42 });
  assert(Array.isArray(res[0].posts), "posts should be an array");
  assert(res[0].posts.length > 0, "posts should have at least one element");
  assert(typeof res[0].posts[0].title === "string", "post.title should be a string");
});
