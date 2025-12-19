# Epic E5 – Task 5.1: Authentication Simulation Testing

## Overview

Complete implementation and testing of authentication logic in the `simulateRequest` function for Bearer Token and API Key authentication methods.

## Acceptance Criteria ✅

All acceptance criteria have been met:

- ✅ **BEARER_TOKEN scenarios**: Valid, Invalid, and Missing Authorization headers → correct status (200 vs 401)
- ✅ **API_KEY scenarios**: Valid, Invalid, and Missing API keys → correct status (200 vs 401)
- ✅ **NO_AUTH scenarios**: Public endpoints work without credentials
- ✅ **Response structure**: All 401 responses include proper error messages
- ✅ **Case-insensitive headers**: Both Bearer Token and API Key handle header name variations

## Implementation Details

### 1. Authentication Logic (mockEngine.ts)

Located in [services/mockEngine.ts](../../services/mockEngine.ts#L186-L216), the authentication check:

```typescript
// SECURITY & AUTHENTICATION CHECK
if (matchedMock.authConfig && matchedMock.authConfig.type !== "NONE") {
  const auth = matchedMock.authConfig;
  const reqHeadersLower = Object.keys(headers).reduce((acc, key) => {
    acc[key.toLowerCase()] = headers[key];
    return acc;
  }, {} as Record<string, string>);

  let isAuthorized = false;

  if (auth.type === "BEARER_TOKEN") {
    const authHeader = reqHeadersLower["authorization"] || "";
    if (
      authHeader.startsWith("Bearer ") &&
      authHeader.substring(7) === auth.token
    ) {
      isAuthorized = true;
    }
  } else if (auth.type === "API_KEY") {
    const headerKey = (auth.headerKey || "x-api-key").toLowerCase();
    const apiKey = reqHeadersLower[headerKey];
    if (apiKey === auth.token) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return {
      response: {
        status: 401,
        body: JSON.stringify(
          {
            error: "Unauthorized",
            message: "Invalid or missing authentication credentials",
          },
          null,
          2
        ),
        headers: [{ key: "Content-Type", value: "application/json" }],
        delay: matchedMock.delay,
      },
      matchedMockId: matchedMock.id,
    };
  }
}
```

### 2. Key Features

#### Bearer Token Authentication

- Header: `Authorization: Bearer <token>`
- Checks for exact token match after "Bearer " prefix
- Case-insensitive header name handling
- Returns 401 if missing, malformed, or token doesn't match

#### API Key Authentication

- Header: `x-api-key` (default, configurable via `authConfig.headerKey`)
- Supports custom header names for flexibility
- Case-insensitive header name handling
- Returns 401 if missing or key doesn't match

#### No Authentication

- Type: `NONE` - endpoint accessible without credentials
- Any request headers are ignored

## Test Coverage

### Test File: `test/authSimulation.test.ts`

**Total Tests: 20** ✅ All Passing

#### Bearer Token Tests (6 tests)

1. ✅ Valid token with Authorization header → 200
2. ✅ Invalid token → 401
3. ✅ Missing Authorization header → 401
4. ✅ Malformed Authorization header (missing Bearer prefix) → 401
5. ✅ Case-insensitive header name (authorization) → 200
6. ✅ Case-insensitive header name (AUTHORIZATION) → 200

#### API Key Tests (7 tests)

7. ✅ Valid key with default header (x-api-key) → 200
8. ✅ Invalid key → 401
9. ✅ Missing default header (x-api-key) → 401
10. ✅ Custom header key → 200
11. ✅ Custom header key with invalid value → 401
12. ✅ Wrong custom header name (using default) → 401
13. ✅ Case-insensitive header name (x-api-key) → 200

#### No Auth Tests (2 tests)

14. ✅ Request without any credentials → 200
15. ✅ Request with any headers → 200

#### Integration Tests (5 tests)

16. ✅ Multiple endpoints with different auth types
17. ✅ POST request with BEARER_TOKEN auth → 200
18. ✅ POST request with BEARER_TOKEN auth (missing token) → 401
19. ✅ DELETE request with API_KEY auth → 200
20. ✅ Verify 401 response structure is correct

## Running Tests

```bash
# Run authentication tests
npm run test:auth

# Or directly with tsx
npx tsx test/authSimulation.test.ts
```

### Expected Output

```
🔐 Starting Authentication Simulation Tests

✅ PASS: BEARER_TOKEN: Valid token with Authorization header → 200
✅ PASS: BEARER_TOKEN: Invalid token → 401 Unauthorized
... (18 more tests)

============================================================
📊 Test Results: 20 passed, 0 failed
============================================================

✨ All authentication tests passed!
```

## Files Modified

1. **test/authSimulation.test.ts** (NEW)

   - Comprehensive authentication testing suite
   - 20 test cases covering all scenarios
   - Full test utilities and mocking setup

2. **package.json** (MODIFIED)
   - Added `test:auth` script for easy test execution

## Technical Notes

### Header Matching

- Headers are converted to lowercase for comparison
- This allows headers like `Authorization`, `AUTHORIZATION`, or `authorization` to work identically
- Custom header names are also case-insensitive

### Response Format (401 Unauthorized)

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication credentials"
}
```

### Supported HTTP Methods

Authentication works with all HTTP methods:

- GET, POST, PUT, PATCH, DELETE

### Type Definitions

Authentication config supports:

```typescript
authConfig: {
  type: 'BEARER_TOKEN' | 'API_KEY' | 'NONE',
  token?: string,              // Token/key value
  headerKey?: string           // (API_KEY only) custom header name
}
```

## Status

**Task Status: COMPLETE** ✅

- Authentication logic implemented in mockEngine.ts
- Comprehensive test suite created with 20 passing tests
- All acceptance criteria met
- Documentation provided
- Ready for integration with frontend UI

## Next Steps

- Integrate authentication UI into MockEditor component
- Add visual indicators for auth-protected endpoints
- Implement auth header editing in UI
- Add pre-built auth templates (JWT, Basic Auth, etc.)
