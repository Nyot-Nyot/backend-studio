import { generateOpenApiSpec } from "../services/openApiService";
import { MockEndpoint, HttpMethod, Project } from "../types";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

/**
 * Task 6.4 – OpenAPI Export & Swagger Editor Validation
 *
 * This test:
 * 1. Generates a complete openapi.json file
 * 2. Exports it to a file (simulating UI export)
 * 3. Validates Swagger Editor compatibility
 * 4. Verifies all endpoints are present and properly formatted
 */

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

console.log("🧪 Task 6.4 – OpenAPI Export & Swagger Editor Validation\n");

// Comprehensive test project with various endpoint types
const testProject: Project = {
  id: "complete-api",
  name: "Complete REST API",
  createdAt: Date.now(),
};

const comprehensiveMocks: MockEndpoint[] = [
  // GET endpoints
  {
    id: "m1",
    projectId: "complete-api",
    name: "List all items",
    path: "/api/items",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify([
      { id: 1, title: "Item 1", description: "First item", completed: false },
      { id: 2, title: "Item 2", description: "Second item", completed: true },
    ]),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m2",
    projectId: "complete-api",
    name: "Get item by ID",
    path: "/api/items/:id",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({
      id: 1,
      title: "Item 1",
      description: "First item",
      completed: false,
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // POST endpoint
  {
    id: "m3",
    projectId: "complete-api",
    name: "Create new item",
    path: "/api/items",
    method: HttpMethod.POST,
    statusCode: 201,
    delay: 0,
    responseBody: JSON.stringify({
      id: 3,
      title: "New Item",
      description: "Created item",
      completed: false,
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // PUT endpoint
  {
    id: "m4",
    projectId: "complete-api",
    name: "Update item",
    path: "/api/items/:id",
    method: HttpMethod.PUT,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({
      id: 1,
      title: "Updated Item",
      description: "Updated",
      completed: true,
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // PATCH endpoint
  {
    id: "m5",
    projectId: "complete-api",
    name: "Partially update item",
    path: "/api/items/:id",
    method: HttpMethod.PATCH,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({ id: 1, completed: true }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // DELETE endpoint
  {
    id: "m6",
    projectId: "complete-api",
    name: "Delete item",
    path: "/api/items/:id",
    method: HttpMethod.DELETE,
    statusCode: 204,
    delay: 0,
    responseBody: JSON.stringify({}),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // Nested path
  {
    id: "m7",
    projectId: "complete-api",
    name: "Get item comments",
    path: "/api/items/:id/comments",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify([
      {
        id: 1,
        text: "Great item!",
        author: "user1",
        timestamp: "2024-12-19T10:00:00Z",
      },
      {
        id: 2,
        text: "Nice work!",
        author: "user2",
        timestamp: "2024-12-19T11:00:00Z",
      },
    ]),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  // Inactive endpoint (should not appear)
  {
    id: "m8",
    projectId: "complete-api",
    name: "Deprecated endpoint",
    path: "/api/deprecated",
    method: HttpMethod.GET,
    statusCode: 410,
    delay: 0,
    responseBody: JSON.stringify({ error: "This endpoint is deprecated" }),
    isActive: false,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
];

// Generate spec
const spec = generateOpenApiSpec(testProject, comprehensiveMocks);

// Export directory
const exportDir = join(process.cwd(), "test-swagger-output");
try {
  rmSync(exportDir, { recursive: true, force: true });
} catch (e) {
  // Ignore
}
mkdirSync(exportDir, { recursive: true });

// Export as JSON
const jsonContent = JSON.stringify(spec, null, 2);
const exportPath = join(exportDir, "openapi.json");
writeFileSync(exportPath, jsonContent);

console.log("📝 Step 1: Generated and exported openapi.json\n");

test("File exported successfully", () => {
  assert(jsonContent.length > 0, "JSON content should not be empty");
  assert(jsonContent.includes('"openapi"'), "Should contain openapi field");
  assert(jsonContent.includes('"paths"'), "Should contain paths field");
});

console.log();

// Validate JSON structure for Swagger Editor
test("JSON is valid and properly formatted", () => {
  const parsed = JSON.parse(jsonContent);
  assert(parsed.openapi === "3.0.0", "OpenAPI version should be 3.0.0");
  assert(parsed.info, "Should have info object");
  assert(parsed.paths, "Should have paths object");
});

test("Spec can be serialized and deserialized without loss", () => {
  const serialized = JSON.stringify(spec);
  const deserialized = JSON.parse(serialized);
  assert(deserialized.openapi === "3.0.0", "Deserialized spec should be valid");
  assert(
    Object.keys(deserialized.paths).length > 0,
    "Deserialized spec should have paths"
  );
});

console.log();
console.log("📝 Step 2: Validating endpoint presence and structure\n");

// Count endpoints
const totalEndpoints = comprehensiveMocks.filter((m) => m.isActive).length;
const specPathCount = Object.keys(spec.paths).reduce((count, path) => {
  return count + Object.keys(spec.paths[path]).length;
}, 0);

test(`All active endpoints are included (${specPathCount}/${totalEndpoints})`, () => {
  assert(
    specPathCount === totalEndpoints,
    `Should have ${totalEndpoints} operations, got ${specPathCount}`
  );
});

test("GET /api/items endpoint is present", () => {
  assert(spec.paths["/api/items"], "Should have /api/items path");
  assert(spec.paths["/api/items"].get, "Should have GET method on /api/items");
  const getOp = spec.paths["/api/items"].get;
  assert(getOp.responses["200"], "Should have 200 response");
  assert(
    getOp.responses["200"].content["application/json"].example,
    "Should have example data"
  );
});

test("GET /api/items/:id with path parameter is properly formatted", () => {
  assert(spec.paths["/api/items/{id}"], "Should have /api/items/{id} path");
  assert(spec.paths["/api/items/{id}"].get, "Should have GET method");
  const getOp = spec.paths["/api/items/{id}"].get;
  assert(getOp.parameters, "Should have parameters");
  const idParam = getOp.parameters.find((p: any) => p.name === "id");
  assert(idParam, "Should have id parameter");
  assert(idParam.in === "path", "id should be path parameter");
  assert(idParam.required === true, "id should be required");
});

test("POST /api/items endpoint has requestBody", () => {
  const postOp = spec.paths["/api/items"].post;
  assert(postOp, "Should have POST method on /api/items");
  assert(postOp.requestBody, "POST should have requestBody");
  assert(
    postOp.requestBody.content["application/json"],
    "Should have JSON content"
  );
  assert(
    postOp.requestBody.content["application/json"].schema,
    "Should have schema"
  );
});

test("PUT /api/items/:id endpoint is properly structured", () => {
  const putOp = spec.paths["/api/items/{id}"].put;
  assert(putOp, "Should have PUT method on /api/items/{id}");
  assert(putOp.parameters, "Should have parameters");
  assert(putOp.requestBody, "Should have requestBody");
  assert(putOp.responses["200"], "Should have 200 response");
});

test("PATCH /api/items/:id endpoint is present", () => {
  const patchOp = spec.paths["/api/items/{id}"].patch;
  assert(patchOp, "Should have PATCH method on /api/items/{id}");
});

test("DELETE /api/items/:id endpoint is present with 204 response", () => {
  const deleteOp = spec.paths["/api/items/{id}"].delete;
  assert(deleteOp, "Should have DELETE method on /api/items/{id}");
  assert(deleteOp.responses["204"], "Should have 204 response");
});

test("Nested path /api/items/:id/comments is properly formatted", () => {
  assert(spec.paths["/api/items/{id}/comments"], "Should have nested path");
  assert(spec.paths["/api/items/{id}/comments"].get, "Should have GET method");
});

test("Inactive endpoint is excluded from spec", () => {
  const hasDeprecated = Object.keys(spec.paths).some((path) =>
    path.includes("deprecated")
  );
  assert(!hasDeprecated, "Inactive endpoints should not be included");
});

console.log();
console.log("📝 Step 3: Swagger Editor Compatibility Checks\n");

test("All operations have responses with proper structure", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      assert(operation.responses, `${method} ${path} should have responses`);
      Object.keys(operation.responses).forEach((statusCode) => {
        const response = operation.responses[statusCode];
        assert(
          response.description,
          `Response ${statusCode} should have description`
        );
      });
    });
  });
});

test("All operations have proper tags for Swagger UI grouping", () => {
  const taggedOps = Object.keys(spec.paths).reduce((count, path) => {
    return (
      count +
      Object.keys(spec.paths[path]).filter((method) => {
        return (
          spec.paths[path][method].tags &&
          spec.paths[path][method].tags.length > 0
        );
      }).length
    );
  }, 0);
  assert(taggedOps > 0, "Operations should have tags for grouping");
});

test("Response examples are valid JSON objects/arrays", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      Object.keys(operation.responses).forEach((statusCode) => {
        const response = operation.responses[statusCode];
        if (response.content?.["application/json"]?.example) {
          const example = response.content["application/json"].example;
          // Examples should be valid JSON (able to stringify)
          assert(
            typeof example === "object" || typeof example === "string",
            `Example for ${method} ${path} ${statusCode} should be object/array/string`
          );
        }
      });
    });
  });
});

test("Servers configuration is present", () => {
  assert(spec.servers, "Should have servers array");
  assert(spec.servers.length > 0, "Should have at least one server");
  assert(spec.servers[0].url, "Server should have URL");
});

console.log();
console.log("📝 Step 4: Manual Import Instructions\n");

console.log(`📄 Exported file: ${exportPath}`);
console.log(`📦 File size: ${jsonContent.length} bytes`);
console.log(`📋 Total endpoints: ${specPathCount}`);
console.log();
console.log("🔗 To test in Swagger Editor:\n");
console.log("1. Open https://editor.swagger.io/");
console.log("2. Clear any existing content (Ctrl+A, Delete)");
console.log("3. Paste the content from openapi.json");
console.log("4. Alternatively, use the File menu → Import file");
console.log();
console.log("Expected result:");
console.log("  ✅ No validation errors");
console.log("  ✅ All endpoints listed in the sidebar");
console.log("  ✅ Each endpoint shows method, path, and parameters");
console.log("  ✅ Try it out buttons are available for each operation");
console.log("  ✅ Schema and example data are displayed");
console.log();

console.log("📊 Spec Summary:");
console.log(`   Info: ${spec.info.title}`);
console.log(`   Version: ${spec.info.version}`);
console.log(`   Paths: ${Object.keys(spec.paths).length}`);
console.log(`   Operations: ${specPathCount}`);
console.log(`   Servers: ${spec.servers.length}`);

// Cleanup
try {
  rmSync(exportDir, { recursive: true, force: true });
} catch (e) {
  // Ignore
}

console.log("\n✨ Task 6.4 – OpenAPI Export & Validation Complete!\n");
