# Service Worker: Request interception and fallback strategy

This document explains the runtime behavior and test strategy for the Service Worker request interception implemented in `sw.js`.

## Behavior summary

- The Service Worker only intercepts same-origin API requests (paths starting with `/api/`). Static assets, HMR, node_modules, and cross-origin requests are left to the network.
- On incoming API request, the handler attempts the following (in this order):
  1. Quick cache lookup (if available). If a cached Response is found it is returned immediately (fastest path).
  2. Parallel client-handling via `postMessage` to a visible window client; the SW opens a `MessageChannel` and waits up to `HANDSHAKE_TIMEOUT_MS` (default 3000ms) for a client response.
  3. A network `fetch()` is started in parallel. The handler uses a race: if the client returns a usable response before the network completes, the client response is used; otherwise the network response is used.
  4. If neither produces a usable response (network errors, or client no response), a final `fetch()` is attempted as a last-resort fallback and errors are surfaced.

## Rationale & edge cases

- The race between client and network ensures we don't wait unnecessarily for slow clients while still allowing client-side logic to override or mock responses.
- A cache check is included to serve cached responses fast when available (important for offline scenarios).
- Logging is used to warn about failures and timeouts; construction failures of client responses fall back to network.

## Tests

- Unit tests for SW logic are included at `test/sw.test.ts`. They simulate the Service Worker environment by polyfilling `self`, `caches`, `MessageChannel`, and minimal `Response`/`Headers` implementations.
- Current tests cover:
  - falling back to network when no client is present
  - using client response when it arrives before network
  - timing out client and falling back to network

## Extending coverage

- Consider adding Playwright or real browser-based tests to validate messaging between the SW and actual client pages under real network conditions (optional / future work).
