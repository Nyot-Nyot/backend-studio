# Testing Checklist (Sprint 3 additions)

## Layout & Responsiveness

-   [x] Automated Playwright layout/responsiveness tests for Chromium at multiple viewports (1366×768, 1440×900, 768×1024) — tests pass.
-   [x] Automated tests also executed in Firefox and passed.
-   [x] Cross‑browser verification (WebKit/Edge/Brave) intentionally **skipped** per request; see sprint notes. If later desired, add cross‑browser CI job for full validation.

## Export / Import / Factory Reset

-   [x] Export Configuration produces a downloadable JSON containing `version`, `timestamp`, `projects`, `mocks` and optionally `envVars` (`test/e2e/export-import.spec.ts`).
-   [x] Import Configuration replaces workspace after user confirmation and shows a success toast; invalid files show a clear error toast.
-   [x] Factory Reset clears localStorage and reloads to default workspace (Ping mock present).

## MockEditor validation (automated tests)

-   [x] Route conflict detection
-   [x] JSON validation and error line highlighting
-   [x] Format / Minify behaviour
-   [x] Array/object conversion and two-way sync

## How to run the tests

-   Install dependencies: `npm install`
-   Run Playwright e2e: `npm run test:e2e`
    -   The Playwright config will run the dev server and run the tests against the running app.
    -   Note: If you want cross-browser tests, ensure Playwright browsers are installable on your system (may require OS packages).
