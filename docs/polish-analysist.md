# Polish Analysis (initial pass)

> Per-file findings. Title is the file name (linked). Each entry lists issues found (UX, code smell, bugs, readability, missing tests, or inconsistencies).

---

### [components/MockEditor.tsx](../components/MockEditor.tsx) complete [x]

-   Visual editor treats arrays as a simple string (disabled input) — poor UX for editing arrays and potential data loss.
-   Root-array support uses `isRootArray` and `Object.values()` when serializing, which can lose keys and is surprising for users.
-   `convertSchemaToJson` coerces numbers with `Number(field.value) || 0` — silently converts invalid numbers to 0 instead of surfacing errors.
-   `validateJsonStructure` relies on JSON.parse errors and `getErrorLine()` parses `at position` strings — brittle and locale-dependent.
-   Several `any` usages (function params, parsed JSON) reduce type-safety and make refactors risky.
-   Accessibility: interactive controls (generator dropdown, add/drag handles, some buttons) lack ARIA labels and keyboard affordances.
-   Drag & drop implementation uses deep clone via `JSON.parse(JSON.stringify(...))` — fine but may be costly; also no undo/confirmation for destructive changes.
-   Missing tests for complex behaviors (drag/drop, array-root handling, generator insertion, AI generation flow).

---

### [components/Dashboard.tsx](../components/Dashboard.tsx) complete [x]

-   Checkbox for selection is read-only and wrapped in a clickable container with `onClick` fragment handling — can be confusing for keyboard/screen-reader users.
-   Copy-to-clipboard flow does not handle errors from `navigator.clipboard.writeText` (no catch) — possible silent failures.
-   UI: Bulk actions toggle and selection UX could be clearer (no multi-select keyboard instructions / no focus state on cards).
-   Method color style helper (`getMethodStyle`) duplicates classes and could be centralized (theme tokens). Minor code smell but maintainable.

---

### [components/EmailExportModal.tsx](../components/EmailExportModal.tsx) complete [x]

-   Modal lacks focus-trap and accessibility details (no `aria-modal`, close button `×` no `aria-label`).
-   Uses `// eslint-disable-next-line react-hooks/exhaustive-deps` on effect that depends on `getAttachmentPreview` — can lead to stale previews if callback changes.
-   Error handling for preview fetch is minimal (swallows errors) and no user feedback beyond empty state.
-   Recipient validation is simplistic (regex) and silently limits to 10 recipients; consider clearer UX and better validation messages.

---

### [types.ts](../types.ts) complete [x]

-   Several `any` types used in shared types (`ScenarioStepLog.output?: any`, `Connector.config: any`, `ScenarioRun.stepLogs` outputs) — loss of type guarantees across services.
-   Consider modeling known shapes (or `unknown` and narrow at use sites) to improve safety.

---

### [config/featureFlags.ts](../config/featureFlags.ts) complete [x]

-   Inconsistent guards for `import.meta.env` (some functions access `import.meta.env` directly, others protect with typeof checks) — can cause runtime issues in non-browser/test environments.
-   Feature flag resolution mixes `import.meta.env` and `window.localStorage` in multiple places; makes behavior hard to reason about and to test.
-   Some defaults (e.g., SW, LOG_VIEWER) return `true` by default; document this behavior and ensure it matches intended production defaults.

---

### [services/aiService.ts](../services/aiService.ts)

-   Checks `FEATURES.AI && !FEATURES.AI()` — redundant and slightly confusing; prefer `if (!FEATURES.AI())`.
-   Throws string-like error codes (`OPENROUTER_DISABLED`) and relies on message matching elsewhere — use typed error classes or constants for more robust handling.
-   Console error logging in library code could be more informative or removed in favor of surfaced errors to the caller.

---

### [services/openrouterClient.ts](../services/openrouterClient.ts)

-   `BASE` fallback concatenation uses env value without consistent guard; may produce invalid URLs when empty or misconfigured.
-   `postJson` sets an `X-OpenRouter-Key` from localStorage for convenience — this may accidentally leak secrets if users store keys there; add explicit opt-in with documentation.
-   Error handling converts non-OK responses into an Error with `res.status` and body text — good, but callers rely on string patterns, which is brittle.

---

### [services/dbService.ts](../services/dbService.ts)

-   Heavy use of `any` for stored records; missing typed collection interfaces.
-   ID generation mixes numeric and short-UUID strategies and returns default `1` for first numeric id, which may surprise consumers (better to document or make consistent).
-   `saveCollection` performs async persist in background (fire-and-forget) — can cause silent persist failures and makes calling code unaware of persistence state.
-   Methods access `localStorage` without `typeof window` guards; tests that run in Node may need mocking/shims.

---

### [sw.js](../sw.js)

-   Service worker has some commented logic about fallbacks but may not handle edge-cases (cache vs network race) — review strategy and add tests for offline flows.
-   Uses verbose inline comments but missing tests or integration checks in CI for SW behavior.

---

### [scripts/email-helper.js](../scripts/email-helper.js)

-   Logs server URLs and options with `console.log` (may leak sensitive info in CI logs); add a --quiet option and avoid printing secrets.
-   No clear input validation for uploads or rate limiting; might be fine for dev but should be documented and sandboxed.

---

### Tests (multiple files) e.g. [test/openApiService.test.ts](../test/openApiService.test.ts)

-   Tests contain many `console.log` statements used for human-readable output — noisy in CI; prefer assertion frameworks and minimal logs.
-   Several test files mock `crypto` globally and modify global objects with `any` casts — fragile and may cause cross-test pollution.

---

---

### [components/Sidebar.tsx](../components/Sidebar.tsx)

-   Navigation items use `div` with `onClick` rather than semantic `button` elements — keyboard and screen-reader accessibility suffers (no role, tabIndex, or key handlers).
-   Collapse/expand control and some action buttons don't have ARIA labels or focus outlines; collapsed project avatar may throw if `projects` is empty.
-   Project deletion is a single-click action; consider confirmation or safer UX for destructive operations.
-   Feature flag checks (`FEATURES.AI()`) directly called in render could be memoized or centralized for readability/testability.

---

### [components/LogViewer.tsx](../components/LogViewer.tsx)

-   Auto-scroll behaviour can be jarring when users pause the feed; there is no option to page or virtualize long logs (memory/performant issues for long streams).
-   `toLocaleTimeString()` used without locale or format considerations — inconsistent display across environments.
-   Filtering uses simple substring matches; lacks highlight of matches and may be slow for large log arrays (no virtualization).
-   No copy-to-clipboard for log lines or easy export; consider bulk export and log retention controls.

---

### [components/DatabaseView.tsx](../components/DatabaseView.tsx)

-   Uses `any[]` for data; table headers are derived from the first row only which breaks for heterogeneous rows.
-   Raw JSON editor allows arbitrary edits with minimal validation; saving invalid JSON is handled but UX could be improved with inline errors, diff view, or undo.
-   Deleting items by index when no id exists is fragile; better surface that records should have stable IDs.
-   No pagination/virtualization for large collections; rendering many rows may be slow.

---

### [components/TestConsole.tsx](../components/TestConsole.tsx)

-   `JsonViewer` splitting logic is naive and can break for nested strings containing colons; fragile small parser — consider a real highlighter or safer tokenization.
-   Headers displayed with numeric keys in mapping (`key={i}`) — use stable keys where possible.
-   Request errors catch and format messages but there is no clear retry/backoff strategy for network failures.

---

### [components/Toast.tsx](../components/Toast.tsx)

-   Toast container is `pointer-events-none` with children `pointer-events-auto` — subtle but may interfere with expected mobile interactions; ensure accessibility (announcements for screen readers).
-   Toast timing (4s) is fixed; consider exposing to callers or allowing longer durations for important errors.

---

### [services/authUtils.ts](../services/authUtils.ts)

-   `formatAuthPreview` renders raw token values in UI which may leak sensitive tokens in screenshots / screen sharing; consider masking or copy-to-clipboard with confirmation.

---

### [services/dataGenerator.ts](../services/dataGenerator.ts)

-   Nested/object/array generation is unimplemented (returns null) — feature gap listed in UI (Generator options include nested types but not supported).
-   Uses global randomness (non-deterministic) making tests harder; consider optional seed for deterministic test generation.

---

### [services/emailService.ts](../services/emailService.ts)

-   Demo mode logs recipients and attachments, which could leak data in dev logs — avoid printing sensitive info.
-   Converts attachments to data URLs (base64) which may be memory heavy for large files; consider streaming or size limits and better error messages for oversized attachments.
-   Requires EmailJS env vars without a clear client-side fallback; document expected env config and secure handling.

---

### [services/exportService.ts](../services/exportService.ts)

-   `renderBodyLiteral` falls back to JSON-stringifying a raw string which embeds a quoted string into generated server code — this can surprise consumers expecting valid JSON responses.
-   Generated server code concatenates route bodies and paths without sanitization / escaping — can break or introduce syntax errors for certain characters in names or paths.
-   Server template uses `require('express')` twice and lacks configurable CORS/timeouts; consider a safer template with escaping and options.

---

### [services/geminiService.ts](../services/geminiService.ts)

-   Deprecated adapter still present — either mark clearly or remove; code reads localStorage directly and uses process.env inconsistently (no guards for non-browser environments).
-   Replaces code fences and trims output but does not robustly validate returned JSON; callers can crash if model output is malformed.

---

### [services/indexedDbService.ts](../services/indexedDbService.ts)

-   Accesses `indexedDB` and `localStorage` without guarding for non-browser environments in some paths; tests/SSR may fail.
-   Migration helper swallows malformed data silently; consider reporting migrated keys and errors to the caller for visibility.
-   Basic ID generation duplicates logic from `dbService` — consider single source of truth to avoid inconsistent id strategies.

---

### [services/mockEngine.ts](../services/mockEngine.ts)

-   `processMockResponse` uses global regex replace for variable substitution — risk of accidental replacements inside string values and ordering conflicts; lack of token-parsing makes it brittle for nested templates.
-   Proxy handling tries to blacklist private IP ranges but relies on basic hostname checks; DNS rebinding or IPv6 obfuscation may bypass checks — add more robust validation or harden in server-side proxy.
-   Always sets `Content-Type: application/json` even when response may be plain text; may confuse clients.
-   Replacement of `{{$randomBool}}` returns strings 'true'/'false' (not boolean) — inconsistent typing in output.

---

### [services/openApiService.ts](../services/openApiService.ts)

-   Infers request schema from response JSON which is likely incorrect and can produce misleading OpenAPI specs.
-   Treats null responses as strings in schema inference which is inconsistent; examples and schema should match correctly.
-   Server URL is hard-coded to `http://localhost:3000`; make configurable or derive from environment.

---

### [services/scenarioService.ts](../services/scenarioService.ts)

-   Templates are applied naively with simple path resolution which may fail on nested/array structures; no sandboxing for template expressions.
-   `runScenario` performs network calls and `window` usage directly — not easily testable on Node without mocks.
-   Error handling rethrows but does not provide structured error types; consider typed failures for consumers.

---

### [services/socketClient.ts](../services/socketClient.ts)

-   Constructs URL using `window.location` and non-HTTPS default port; logging statements are present in production code which can be noisy.
-   No backoff policy visibility, and connect() silently does nothing if socket already exists (ok but could report status).
-   Event handlers are attached even before the socket exists (connect is triggered lazily) — good, but add tests for this behavior.

---

### [services/uploadService.ts](../services/uploadService.ts)

-   Uses hard-coded localhost endpoints and HTTP (no TLS); environment detection is inconsistent (import.meta vs process.env).
-   No timeouts or retry logic for uploads; errors are propagated with minimal context.

---

### [services/zipService.ts](../services/zipService.ts)

-   Handles Blob/ArrayBuffer differences but has no streaming option for very large payloads; consider size checks and memory considerations for large exports.

---

### [scripts/openrouter-proxy.cjs](../scripts/openrouter-proxy.cjs)

-   Accepting client-provided API keys when `DEV_ALLOW_CLIENT_KEY=1` is potentially unsafe (clients could use their keys or leak them); document and guard carefully.
-   Proxy strips code fences but still relies on model output formatting — validate model output strictly before returning to clients.
-   Logs endpoints and redacted key — be careful about logging in production (consider --quiet flag).

---

### [scripts/socket-server.cjs](../scripts/socket-server.cjs)

-   Accepts `origin: '*'` in socket.io CORS config — ok for local dev but not for production; add environment-based hardening.
-   `log:publish` handler broadcasts arbitrary payloads without validation or rate-limiting — consider validating shape and size to avoid abuse.
-   Simple token auth is fine but storing auth token in env variable with everyone allowed to read can be risky; document secure deployment guidance.

---

### [App.tsx](../App.tsx)

-   Exposes several DEV-only helpers on `window` (e.g., `__applyTestFixtures`, `__simulateRequest`) which are useful for testing but should be gated strictly to DEV and documented; consider namespacing to avoid collisions and ensure they are removed in production builds.
-   Many `confirm()` and `prompt()` uses for critical flows (import, factory reset, generation prompt) — poor UX for automation and accessibility; consider replace with modal dialogs and clearer messaging.
-   Multiple `fetch` calls without timeouts or centralized error handling (e.g., emit-log fallback); network errors can hang or produce inconsistent states.
-   Service Worker messaging flow assumes a responsive client; there is no timeout or circuit breaker on the SW message round-trip (SW can hang if client unresponsive).
-   Several `console.info/debug` logs are present in production paths (e.g., forwarding logs, socket events) — noisy and may leak data in production; consider conditional logging or a debug flag.
-   Direct use of `localStorage` and `navigator` APIs without defensive guards could fail in non-browser environments (tests, SSR); consider utility wrappers and centralizing storage access.
-   Security: saving API keys to `localStorage` (and displaying them) is documented in UI as visible, but consider stronger guidance or obfuscation and explicit warnings.

---

### [index.tsx](../index.tsx)

-   Registers Service Worker with simple success/failure console logs; SW registration failures are only logged to console — consider adding telemetry or user-facing error when SW is central feature.
-   `dbService.init` is awaited before rendering but errors are only warned — consider fallback flow and clearer startup error UI.
-   No guard around `navigator.serviceWorker` when running in non-browser test harnesses (some test runners might not provide it) — tests already stub but ensure init does not throw.

---

### [index.html](../index.html)

-   Uses CDN-hosted Tailwind and Google fonts at runtime — simplicity vs reliability tradeoff; consider bundling or documenting offline/corporate firewall impacts.
-   No Content Security Policy (CSP) header/meta — recommended to add to prevent injection when hosting in less-trusted environments.
-   Import map pulls several packages from third-party CDNs (esm.sh) which may affect reproducibility and security; prefer pinning or documenting expected fallback behavior.

---

### [sw.js](../sw.js)

-   Service worker chooses the visible client or falls back to first client; however there is no timeout on message response which can lead to unresolved fetch Promises if the client doesn't respond — add a timeout to reject/ fallback to network.
-   Binary or non-text responses are not supported (body serialized as text) — this limits the simulation to text-based JSON bodies.
-   Error handling falls back to fetch but there is limited telemetry to detect repeated SW communication failures; consider metrics or user notifications.

---

### Test Infrastructure & CI (tests, playwright, package.json)

-   Tests include many `console.log` outputs and ad-hoc assertion helpers (e.g., `assert`, `assertEqual`) — replace with standard test assertions (expect/should) for better CI readability and failure reporting.
-   Several tests mutate global objects (e.g., `global.crypto`), or monkey-patch `Object.keys` — these can leak between tests; enforce `afterEach` cleanup or use restoration helpers.
-   Playwright config runs `npm run dev` as webServer; ensure `dev` command does not change PORT or environment for CI and consider caching/reuse strategies to speed CI.
-   Package scripts run many individual test files with `tsx` — consider consolidating unit tests under a single runner for consistent reporting and parallelization.

---

## Developer-focused refactor opportunities (clean / readable / maintainable / idiomatic)

Below are targeted refactor ideas organized per area. Each item links to the file and lists concrete, actionable improvements that increase readability, maintainability, and align the code with idiomatic TypeScript/React/Node patterns.

---

### [components/MockEditor.tsx](../components/MockEditor.tsx)

-   Split big component into focused subcomponents and hooks:
    -   Extract visual schema editor (FieldRow, JsonHighlightOverlay) to smaller components and place local state & helpers into custom hooks (useSchemaEditor, useDragDrop) to reduce render complexity.
    -   Move JSON validation and parsing helpers (validateJsonStructure, parseJsonToSchema, convertSchemaToJson) into a testable util module with well-typed I/O.
-   Replace many `any` usages with explicit types or `unknown` + guards; add unit tests for parsing/serialization edge-cases (arrays, null, nested objects).
-   Improve UX/maintenance by modelling arrays and object nodes consistently (explicit ArrayField vs ObjectField types) rather than string-encoded arrays.
-   Replace deep-clone via JSON stringify with structured cloning or targeted tree operations to avoid silent data loss and improve performance.
-   Add keyboard accessibility and ARIA attributes by converting non-interactive elements to semantic buttons and using roving-tabindex patterns where appropriate.

---

### [components/Dashboard.tsx](../components/Dashboard.tsx)

-   Extract Card and Selection logic into smaller components (MockCard, BulkActionBar). Keep Dashboard as composition only.
-   Replace `div`-based interactive elements with semantic controls and standardize keyboard/focus behavior. Add tests for selection flow.
-   Centralize style mapping (getMethodStyle) into theme tokens or a small helper that returns a classmap or style object for easier unit testing.
-   Wrap clipboard calls in small util (copyText) that returns a Promise and surface user-facing error handling.

---

### [components/EmailExportModal.tsx](../components/EmailExportModal.tsx)

-   Extract preview fetch into a hook `useAttachmentPreview` that memoizes based on options and cleanly handles loading/error states (removes eslint-disable and stale dependency issues).
-   Add focus-trap and aria attributes; replace close `×` with an accessible button element and provide keyboard shortcuts.
-   Move recipient validation logic to a small utility with clear unit tests and explicit error types (tooManyRecipients, invalidEmail).

---

### [components/Sidebar.tsx](/components/Sidebar.tsx)

-   Replace clickable `div` nav items with a `NavItem` component that is a real `button` or `a` element supporting keyboard activation and role semantics.
-   Isolate collapsed-state rendering (small avatar) to avoid crashes when `projects` is empty and add unit tests for collapse/expand boundaries.

---

### [components/LogViewer.tsx] and [components/DatabaseView.tsx]

-   Performance: virtualize long lists (react-window/react-virtual) to improve memory and rendering.
-   Move filtering logic to memoized selectors (useMemo) and add debounce to filter input.
-   Extract small presentational components for rows and make them pure components to avoid re-renders.

---

### [components/TestConsole.tsx] & [components/Json helpers]

-   Replace fragile inline JSON highlighter with a small utility or library; separate presentation from parsing logic.
-   Normalize error handling for network requests and add retry/backoff wrapper around fetch calls.

---

### [services/dbService.ts] & [services/indexedDbService.ts]

-   Introduce typed collection interfaces and generic `DB<T>` helpers so insert/update/find methods are typed (DB.getCollection<T>()).
-   Consolidate ID generation logic into a single util with clear strategy (numeric vs uuid) and document migration path; add tests for id edge-cases.
-   Avoid background fire-and-forget persistence for critical paths; provide `saveCollectionAsync` and use the returned Promise in important flows.

---

### [services/mockEngine.ts]

-   Replace ad-hoc template replacement with a small, tokenized parser so replacements are not accidentally applied inside unrelated strings; use a deterministic order and add tests for nested placeholders.
-   Extract proxy validation and HTTP client into a separate module with clear inputs/outputs and tests. Use AbortController consistently and add timeout handling.
-   Make return types consistent (boolean for random bool), and ensure headers/content-type rules are explicit.

---

### [services/openrouterClient.ts, services/aiService.ts, services/geminiService.ts]

-   Standardize provider responses into typed result shapes and use typed error classes for common failures; avoid callers relying on string matching in messages.
-   Centralize API key handling and opt-in header injection (not implicit localStorage pick-up). Document dev-only overrides and guard behind explicit flags.

---

### [services/exportService.ts]

-   Use a template engine or AST serializer for generated server code rather than string concatenation to avoid syntax errors and security issues. Validate generated code by parsing it in tests.
-   Move server template into its own file and expose hooks to configure CORS, body parser, and logging options.

---

### [sw.js] and Service Worker flow

-   Wrap postMessage handshake in a helper with a timeout/fallback to prevent hung requests; centralize handling logic and test with mocked clients.
-   Add support for non-text responses or fail-fast with clear logs; add tests to simulate delayed/unresponsive clients and verify fallback behavior.

---

### [App.tsx] & global concerns

-   Break down `App.tsx` into smaller feature modules (App shell, Settings, Feature toggles, SW/Socket orchestration) and extract side-effect heavy logic into services/hooks (useSocket, useServiceWorker, usePersistentStorage).
-   Replace ad-hoc `confirm()`/`prompt()` with modal components that are testable and accessible. Remove DEV helpers from global window in production builds using a guard.
-   Centralize localStorage access behind a StorageService with graceful fallbacks for non-browser environments (use `fake-indexeddb` in tests). Make storage keys constants and document format and version.
-   Introduce a tiny logger abstraction that can be silenced in production and supports structured logs for easier debugging.

---

### Tests & CI

-   Replace informal assertion helpers with a test runner's assertion API (e.g., Playwright's expect or Node test expectations). Add `beforeEach`/`afterEach` cleanup for mutated globals and run tests in isolated JSDOM/Node contexts.
-   Add unit tests that target small pure utilities (parsers, schema conversions, template replacer) to reduce reliance on large integration tests and to make refactors safer.

---

## Production readiness checklist (prioritized, actionable)

Below are concrete checkpoints and recommended implementation tasks organized by priority (P0 = must-fix before production, P1 = high priority, P2 = medium, P3 = long-term improvements). Each item includes short implementation guidance and who/what to test.

### P0 — Critical (blockers for production)

-   Security: secrets & API keys
    -   Remove implicit API key pickup from localStorage; require explicit opt-in and document. Move server keys to the proxy (server-side) and forbid client-side production keys. Add unit tests and an e2e test that verifies behavior when key is missing. (Files: `openrouterClient.ts`, `openrouter-proxy.cjs`)
-   Storage reliability & data integrity
    -   Make `dbService.saveCollection` optionally return a Promise (use `persistCollectionAsync`) and use it in flows that must be durable (imports/exports, factory reset). Add integration tests that assert persistence across reloads. (Files: `dbService.ts`, `indexedDbService.ts`)
-   Service Worker robustness
    -   Add a handshake helper with a timeout (e.g., 2s) around postMessage to avoid hanging intercepted fetches; fallback to network if timed out. Add tests to simulate unresponsive client and timed fallback. (Files: `sw.js`, `App.tsx`)
-   Tests & CI
    -   Configure CI (GitHub Actions) to run: lint, unit tests, type-check (tsc --noEmit), dependency audit (npm audit or `npm audit --audit-level=moderate`), and E2E run (Playwright). Fail pipeline on audit high or critical vulnerabilities. Add caching for node_modules and Playwright browsers. (Files: `.github/workflows/ci.yml` - add)
-   Input validation & error handling
    -   Harden all external inputs (file imports, proxy target, upload endpoints) with explicit validation and informative error messages; add tests for invalid inputs. (Files: `openrouter-proxy.cjs`, `uploadService.ts`, `App.tsx` import logic)

### P1 — High priority (should be done before production launch)

-   Type Safety
    -   Replace critical `any` usage with typed interfaces (start with `types.ts` and `dbService`, `mockEngine`, `openrouterClient`). Add targeted unit tests to validate contracts. Enable incremental TypeScript strictness rules (noImplicitAny for new files). (Files: `types.ts`, `dbService.ts`)
-   Logging & Observability
    -   Add a logger abstraction (debug/info/warn/error) that can be enabled via env and integrate a Sentry or similar stub for errors. Add structured error handling and user-friendly messages on UI. Add tests that verify error propagation. (Files: `App.tsx`, services)
-   Secrets & Config
    -   Create an `env.example` and expected env var docs (VITE*OPENROUTER_KEY, EMAILJS*\*, SOCKET_AUTH_TOKEN). Add runtime checks that fail early if required production envs missing.
-   Accessibility
    -   Run an automated a11y check (axe-core or Playwright + axe) and fix high-impact failures (focus order, buttons/labels, modal traps). Add an accessibility test in CI that fails on violations above a threshold. (Files: components: `EmailExportModal.tsx`, `Sidebar.tsx`, `Dashboard.tsx`, `MockEditor.tsx`)
-   Service hardening
    -   In `scripts/socket-server.cjs`, restrict CORS by default in production and add payload validation + rate limiting. Add tests for auth failure and message schema.

### P2 — Medium priority (improves maintainability & performance)

-   Performance
    -   Virtualize long lists in `LogViewer` and `DatabaseView`. Add benchmarks for large data sets to ensure responsiveness.
-   Refactor large components
    -   Break `MockEditor.tsx` and `App.tsx` into smaller components/hooks (see refactor suggestions above) and add unit tests for each extracted hook/utility.
-   Export & packaging
    -   Validate generated `server.js` via a build-time parser and provide a `Dockerfile` template for running exported server. Add tests to run the generated server and smoke-test endpoints.
-   Security headers & CSP
    -   Add recommended CSP meta and recommend HTTP header configuration for production deployment (document in README).

### P3 — Long-term improvements

-   Full TS strict migration (enable strict mode and address issues gradually).
-   Add runtime metrics (request count, error rate) and configure alerting (e.g., Prometheus/Grafana or SaaS alternative) for deployed proxies/servers.
-   Add end-user documentation: troubleshooting, FAQ, migration guide for breaking changes.

---
