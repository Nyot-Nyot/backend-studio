import { generateServerCode } from "../services/exportService";
import { MockEndpoint, HttpMethod } from "../types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
  } catch (e) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${(e as Error).message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log("🧪 Starting generateServerCode tests\n");

const mocks: MockEndpoint[] = [
  {
    id: "m1",
    projectId: "p1",
    name: "Get User",
    path: "/users/:id",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ id: 1, name: "Alice" }),
    isActive: true,
    version: "1",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m2",
    projectId: "p1",
    name: "Create Post",
    path: "/posts",
    method: HttpMethod.POST,
    statusCode: 201,
    delay: 0,
    responseBody: JSON.stringify({ success: true }),
    isActive: true,
    version: "1",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
];

test("Generated code contains CORS and JSON middleware", () => {
  const code = generateServerCode(mocks);
  assert(
    code.includes("app.use(cors())") || code.includes("app.use(cors());"),
    "Missing cors middleware"
  );
  assert(
    code.includes("json()") || code.includes("express').json"),
    "Missing express.json middleware"
  );
});

test("Generated code adds logger middleware", () => {
  const code = generateServerCode(mocks);
  assert(code.includes("res.on('finish'"), "Missing res.on('finish' logger)");
});

test("Generated code contains route handlers with correct methods and paths", () => {
  const code = generateServerCode(mocks);
  assert(code.includes("app.get('/users/:id'"), "Missing GET /users/:id route");
  assert(code.includes("app.post('/posts'"), "Missing POST /posts route");
});

test("Generated code inlines valid JSON body literals", () => {
  const code = generateServerCode(mocks);
  // Ensure the json body for first mock appears as a JS object literal with the property "name"
  assert(
    code.includes('"name": "Alice"'),
    "Response body for user should include name: Alice"
  );
  assert(
    code.includes("const status = 200") &&
      code.includes("res.status(status).json"),
    "Should set status 200 and call json for GET route"
  );
});

console.log("\n🧪 generateServerCode tests completed\n");
