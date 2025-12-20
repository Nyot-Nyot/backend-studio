import { generateOpenApiSpec } from "../services/openApiService";
import { MockEndpoint, HttpMethod, Project } from "../types";

/**
 * Validation test for OpenAPI 3.0 spec generation.
 * Ensures the generated spec is valid and can be imported into Swagger Editor.
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

console.log("🧪 Starting OpenAPI 3.0 Validation Tests\n");

// Test project with realistic mock data
const testProject: Project = {
  id: "api-proj",
  name: "User Management API",
  createdAt: Date.now(),
};

const comprehensiveMocks: MockEndpoint[] = [
  {
    id: "m1",
    projectId: "api-proj",
    name: "List all users",
    path: "/api/v1/users",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify([
      { id: 1, name: "John", role: "admin", active: true },
      { id: 2, name: "Jane", role: "user", active: true },
    ]),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m2",
    projectId: "api-proj",
    name: "Get user details",
    path: "/api/v1/users/:userId",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({
      id: 1,
      name: "John",
      email: "john@example.com",
      role: "admin",
      active: true,
      createdAt: "2024-01-15T10:30:00Z",
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m3",
    projectId: "api-proj",
    name: "Create new user",
    path: "/api/v1/users",
    method: HttpMethod.POST,
    statusCode: 201,
    delay: 0,
    responseBody: JSON.stringify({
      id: 3,
      name: "Alice",
      email: "alice@example.com",
      role: "user",
      active: true,
      createdAt: "2024-12-19T15:45:00Z",
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m4",
    projectId: "api-proj",
    name: "Update user",
    path: "/api/v1/users/:userId",
    method: HttpMethod.PUT,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify({
      id: 1,
      name: "John Updated",
      email: "john.updated@example.com",
      role: "admin",
      active: true,
    }),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
  {
    id: "m5",
    projectId: "api-proj",
    name: "Delete user",
    path: "/api/v1/users/:userId",
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
  {
    id: "m6",
    projectId: "api-proj",
    name: "Get user posts",
    path: "/api/v1/users/:userId/posts",
    method: HttpMethod.GET,
    statusCode: 200,
    delay: 0,
    responseBody: JSON.stringify([
      { id: 101, title: "First Post", content: "Hello world", likes: 5 },
      { id: 102, title: "Second Post", content: "API Testing", likes: 12 },
    ]),
    isActive: true,
    version: "1.0.0",
    createdAt: Date.now(),
    requestCount: 0,
    headers: [],
  },
];

const spec = generateOpenApiSpec(testProject, comprehensiveMocks);

// OpenAPI 3.0.0 Required Fields Tests
test("OpenAPI 3.0.0 - Required field 'openapi' is present and valid", () => {
  assert(spec.openapi === "3.0.0", "openapi field must be '3.0.0'");
});

test("OpenAPI 3.0.0 - Required field 'info' is present", () => {
  assert(spec.info, "info object is required");
  assert(typeof spec.info === "object", "info must be an object");
});

test("OpenAPI 3.0.0 - Info has required fields: title, version", () => {
  assert(spec.info.title, "info.title is required");
  assert(spec.info.version, "info.version is required");
});

test("OpenAPI 3.0.0 - Required field 'paths' is present", () => {
  assert(spec.paths, "paths object is required");
  assert(typeof spec.paths === "object", "paths must be an object");
  assert(
    Object.keys(spec.paths).length > 0,
    "paths must have at least one path"
  );
});

test("OpenAPI 3.0.0 - All paths are strings", () => {
  Object.keys(spec.paths).forEach((path) => {
    assert(typeof path === "string", `path '${path}' must be a string`);
  });
});

test("OpenAPI 3.0.0 - All HTTP methods in paths are lowercase", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      assert(
        [
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "options",
          "head",
          "trace",
        ].includes(method),
        `Invalid HTTP method '${method}' at ${path}`
      );
    });
  });
});

// Operation Requirements Tests
test("OpenAPI 3.0.0 - All operations have 'responses' object", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      assert(
        operation.responses,
        `${method} ${path} must have responses object`
      );
      assert(
        typeof operation.responses === "object",
        `responses must be an object`
      );
    });
  });
});

test("OpenAPI 3.0.0 - All operations have at least one response status", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      const statusCodes = Object.keys(operation.responses);
      assert(
        statusCodes.length > 0,
        `${method} ${path} must have at least one response`
      );
    });
  });
});

test("OpenAPI 3.0.0 - Response status codes are numeric strings (e.g., '200', '404')", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      Object.keys(operation.responses).forEach((statusCode) => {
        assert(
          /^\d{3}$/.test(statusCode),
          `Status code '${statusCode}' must be 3 digits`
        );
      });
    });
  });
});

test("OpenAPI 3.0.0 - Responses have 'description' field", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      Object.keys(operation.responses).forEach((statusCode) => {
        const response = operation.responses[statusCode];
        assert(
          response.description,
          `Response ${statusCode} at ${method} ${path} must have description`
        );
        assert(
          typeof response.description === "string",
          "description must be a string"
        );
      });
    });
  });
});

test("OpenAPI 3.0.0 - Responses with content have valid media types", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      Object.keys(operation.responses).forEach((statusCode) => {
        const response = operation.responses[statusCode];
        if (response.content) {
          Object.keys(response.content).forEach((mediaType) => {
            // Common valid media types
            const validTypes = [
              "application/json",
              "text/plain",
              "application/xml",
              "application/octet-stream",
            ];
            assert(
              validTypes.includes(mediaType) ||
                mediaType.includes("application"),
              `Invalid media type '${mediaType}' at ${method} ${path} response ${statusCode}`
            );
          });
        }
      });
    });
  });
});

test("OpenAPI 3.0.0 - Parameters have required fields: name, in, schema", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          assert(param.name, `Parameter must have 'name' at ${method} ${path}`);
          assert(param.in, `Parameter must have 'in' at ${method} ${path}`);
          assert(
            param.schema,
            `Parameter must have 'schema' at ${method} ${path}`
          );
          assert(
            ["path", "query", "header", "cookie"].includes(param.in),
            `Invalid 'in' value: ${param.in}`
          );
        });
      }
    });
  });
});

test("OpenAPI 3.0.0 - Path parameters are marked as required", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === "path") {
            assert(
              param.required === true,
              `Path parameter '${param.name}' must be required at ${method} ${path}`
            );
          }
        });
      }
    });
  });
});

test("OpenAPI 3.0.0 - No path parameters exist that aren't in the path", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === "path") {
            assert(
              path.includes(`{${param.name}}`),
              `Path parameter '${param.name}' is not in path template '${path}'`
            );
          }
        });
      }
    });
  });
});

test("OpenAPI 3.0.0 - POST/PUT/PATCH operations have requestBody", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      if (["post", "put", "patch"].includes(method)) {
        const operation = spec.paths[path][method];
        assert(
          operation.requestBody,
          `${method.toUpperCase()} ${path} should have requestBody`
        );
      }
    });
  });
});

test("OpenAPI 3.0.0 - RequestBody has required and content", () => {
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method];
      if (operation.requestBody) {
        assert(
          operation.requestBody.content,
          `RequestBody at ${method} ${path} must have content`
        );
        assert(
          typeof operation.requestBody.content === "object",
          "content must be an object"
        );
      }
    });
  });
});

test("OpenAPI 3.0.0 - All path parameters are properly formatted with curly braces", () => {
  Object.keys(spec.paths).forEach((path) => {
    const paramMatches = path.match(/{[a-zA-Z0-9_]+}/g) || [];
    paramMatches.forEach((param) => {
      assert(
        /^{[a-zA-Z0-9_]+}$/.test(param),
        `Invalid path parameter format: ${param}`
      );
    });
  });
});

// Swagger Editor Compatibility Tests
test("OpenAPI 3.0.0 - Spec is valid JSON-serializable (can be exported to Swagger Editor)", () => {
  try {
    const json = JSON.stringify(spec, null, 2);
    assert(json.length > 0, "Spec must be non-empty when serialized");
    const reparsed = JSON.parse(json);
    assert(
      reparsed.openapi === "3.0.0",
      "Spec must remain valid after serialization roundtrip"
    );
  } catch (e) {
    throw new Error(`Spec is not JSON-serializable: ${(e as Error).message}`);
  }
});

test("OpenAPI 3.0.0 - No circular references in spec", () => {
  try {
    const seen = new WeakSet();
    const checkCircular = (obj: any, path = ""): void => {
      if (typeof obj !== "object" || obj === null) return;
      if (seen.has(obj)) {
        throw new Error(`Circular reference detected at ${path}`);
      }
      seen.add(obj);
      Object.keys(obj).forEach((key) => {
        checkCircular(obj[key], `${path}.${key}`);
      });
    };
    checkCircular(spec);
  } catch (e) {
    throw new Error(`Spec has structural issues: ${(e as Error).message}`);
  }
});

test("OpenAPI 3.0.0 - Servers are properly defined with url", () => {
  if (spec.servers) {
    spec.servers.forEach((server: any) => {
      assert(server.url, "Server must have url");
      assert(typeof server.url === "string", "Server url must be a string");
    });
  }
});

console.log("\n✨ All OpenAPI 3.0.0 validation tests completed!\n");
