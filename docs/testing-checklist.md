# Testing Checklist (Sprint 3 additions)

## Workspace & Project Management

-   [x] Create a new workspace/project via UI (New Project button) and verify it appears in the project list. (tested via Playwright; pass in Chromium & Firefox)
-   [x] Delete a project and confirm at least one project remains (prevent deletion of last project). (verified by `test/e2e/workspace.spec.ts`)
-   [x] Switch between projects and verify state persists after reload. (verified by `test/e2e/workspace.spec.ts`)
-   [ ] Rename a project and verify name reflected across UI and exports. (TODO: implement UI support and add e2e test, or explicitly document limitation)
-   [x] Project import (replace) prompts confirmation and fully replaces current workspace when accepted (no partial corruption). (tested via Playwright; pass in Chromium & Firefox)
-   [x] Project import with invalid JSON shows clear error and preserves existing workspace. (tested via Playwright; pass in Chromium & Firefox)

## Layout & Responsiveness

-   [x] Automated Playwright layout/responsiveness tests for Chromium at multiple viewports (1366×768, 1440×900, 768×1024) — tests pass.
-   [x] Automated tests also executed in Firefox and passed.
-   [x] Cross‑browser verification (WebKit/Edge/Brave) intentionally **skipped** per request; see sprint notes. If later desired, add cross‑browser CI job for full validation.

## Export / Import / Factory Reset

-   [x] Export Configuration produces a downloadable JSON containing `version`, `timestamp`, `projects`, `mocks` and optionally `envVars` (`test/e2e/export-import.spec.ts`).
-   [x] Import Configuration replaces workspace after user confirmation and shows a success toast; invalid files show a clear error toast.
-   [x] Factory Reset clears localStorage and reloads to default workspace (Ping mock present).
-   [x] Export `openapi.json` (OpenAPI) and verify in Swagger Editor / Swagger UI that schema is valid. (verified by `npm run test:openapi` / `npm run test:swagger`)
-   [x] Export server bundle (`server.js`, `package.json`) — run `npm install` and `node server.js` and verify exported endpoints behave as in app. (verified by `npm run test:export`)
-   [x] Ensure exported server includes mocks and DB initial data or documents clear instructions to populate them before run. (verified by export tests)
-   [x] Exporting with incomplete workspace data should show a clear warning and not produce a corrupt bundle. (verified in e2e import tests)
-   [ ] Export parity: Add tests and/or documentation verifying whether exported `server.js` preserves route-level auth, delay simulation, and stateful DB behavior, or explicitly document that export is intentionally minimal (TODO: decide and add tests).

## MockEditor validation (automated tests)

-   [x] Route conflict detection
-   [x] JSON validation and error line highlighting
-   [x] Format / Minify behaviour
-   [x] Array/object conversion and two-way sync

## Route Design & Mocking

-   [x] Add a new route for each method (GET, POST, PUT, DELETE, PATCH) and verify the endpoint responds as configured. (verified by unit/e2e tests)
-   [x] Add routes with dynamic params (e.g., `/api/users/:id`) and validate `@param` substitution in responses. (verified by unit tests)
-   [x] Verify method+path conflict detection: creating duplicate path+method shows `Route conflict: ... already exists` and prevents save. (verified in Playwright e2e)
-   [x] Ensure saving is blocked when `conflictError` or `jsonError` is present; UI shows helpful message. (verified in Playwright e2e)
-   [x] Test nested path and query matching with `@query` placeholders. (verified in unit tests)
-   [x] Verify response headers and status code settings are applied to responses. (verified in export/server tests)
-   [x] Test route-level auth settings are enforced by the request pipeline. (verified in auth scenario tests)

## Response Body & Generators

-   [x] Test built-in placeholders: `{{$uuid}}`, `{{$randomEmail}}`, `{{$isoDate}}`, `{{$randomName}}`, `{{$randomInt}}` — verify format and uniqueness as expected. (verified in unit tests)
-   [x] Test `{{@param.*}}` and `{{@query.*}}` placeholder substitution in responses with dynamic path and query examples. (verified in unit/e2e tests)
-   [x] Test `{{$faker*}}` patterns (if implemented) and ensure expected output shape. (faker aliases implemented and verified)
-   [x] Test nested objects/arrays in responses with placeholder expansion. (verified in e2e)
-   [x] Test pretty-printed responses and minified options from MockEditor. (verified in UI tests)
-   [x] Test generators interacting with stateful DB (e.g., POST creates resource, subsequent GET returns it). (verified in simulateRequest tests)
-   [ ] Gemini/AI generation: Verify that AI-based generation (Magic Create / generateEndpointConfig) handles missing/invalid API keys gracefully and surfaces a clear, actionable error message to the user. (TODO: add unit + integration tests)

## Stateful Mocking (DatabaseView)

-   [x] Insert a record via UI and verify it appears in `DatabaseView` and in subsequent GET responses. (verified via simulateRequest tests)
-   [x] Update a record and confirm changes reflect in responses and persisted storage. (verified via simulateRequest tests)
-   [x] Delete a record and ensure it is no longer returned by GET requests. (verified via simulateRequest tests)
-   [x] Verify data persisted in LocalStorage after page reload. (verified via e2e tests)
-   [x] Test factory reset clears database state. (verified via e2e tests)
-   [x] Test concurrent inserts produce unique IDs and consistent state. (verified via simulateRequest tests)

## Authentication

-   [x] `NONE` auth: routes configured without auth should succeed without credentials. (verified in auth scenario tests)
-   [x] `BEARER_TOKEN` auth: valid token in `Authorization: Bearer <token>` succeeds; invalid/absent token returns 401. (verified in auth scenario tests)
-   [x] `API_KEY` auth: valid key in header or query param succeeds; invalid/absent key returns 401. (verified in auth scenario tests)
-   [x] Test Test Console can supply/stash credentials and send authenticated requests. (verified via e2e/mockEditor-auth)
-   [x] Verify auth is applied per-route (route-level overrides workspace default). (verified in tests)

## Testing & Monitoring (Test Console & LogViewer)

-   [x] Test Console can send requests and display responses (status, headers, body, timing). (verified in e2e/functional tests)
-   [x] Test Console supports custom headers, body, query params, and shows errors when request fails. (verified in e2e tests)
-   [x] LogViewer records incoming requests, shows request/response details and timestamps. (verified in e2e tests)
-   [x] LogViewer can be cleared and does not persist after factory reset. (verified in e2e tests)
-   [x] Confirm logs reflect auth failures and request/response bodies for debugging. (verified in tests)

## How to run the tests

-   Install dependencies: `npm install`
-   Run Playwright e2e: `npm run test:e2e`
    -   The Playwright config will run the dev server and run the tests against the running app.
    -   Note: If you want cross-browser tests, ensure Playwright browsers are installable on your system (may require OS packages).
