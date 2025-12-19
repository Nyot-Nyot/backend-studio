# Next Feature Plan: Email Protocol Simulation, External API Integration, Socket Programming, and IndexedDB Migration

Status: Proposal (Sprint-2 / Feature Branch: next-feature)
Owner: Team Backend Studio

---

## 1. Goals & Scope

We will extend the current SPA (ServiceWorker-driven API simulator) with:

1. Email protocol (simulation):

    - Provide an Email Console to "send" emails through mock endpoints and record a SMTP-like protocol trace (HELO, MAIL FROM, RCPT TO, DATA, QUIT).
    - Maintain an Outbox (and optional Inbox) persisted in browser storage.
    - Simulate delivery status transitions over time (queued → sending → delivered/failed).

2. API (external) integration:

    - Add a small UI panel to fetch live data from a public API (RandomUser, OpenWeather, etc.).
    - Demonstrate HTTP client patterns, error handling, and auth (if needed).

3. Socket programming (real-time updates):

    - Provide live status updates for email delivery.
    - Start with SSE (Server-Sent Events) simulated through Service Worker stream; optional upgrade to WebSocket dev server for chat demo.

4. IndexedDB migration:
    - Introduce an IndexedDB-backed storage layer to persist projects, mocks, env vars, logs, and the new email outbox/inbox.
    - Keep LocalStorage as fallback; provide data migration path and backup/export.

Non-goals: Multi-user sync, production email sending, paid third-party dependencies.

---

## 2. Constraints & Alignment with PRD/Sprint Planning

-   Continue to run entirely in the browser (no required backend). Optional WS dev server is for demo only.
-   Maintain current UX structure (Dashboard, MockEditor, LogViewer, TestConsole).
-   Ensure new features don’t break existing Service Worker interception and mock engine.
-   Storage policies: data stays local in the browser (PRD 5.2 Security). IndexedDB is an allowed extension.
-   Keep costs at zero; any external API must be free/public or use user-provided API key.

---

## 3. High-level Architecture Changes

3.1 Email Layer

-   Endpoints (mocked by sw.js + mockEngine):
    -   POST /api/email/send → returns { messageId, status: 'queued', trace: string[] }
    -   GET /api/email/status/:id → returns { messageId, status, updatedAt }
    -   GET /api/email/inbox → returns [Message]
-   State model:
    -   EmailMessage: { id, to, subject, body, status, trace[], createdAt, updatedAt }
    -   Outbox: collection of EmailMessage
    -   Optional Inbox: same shape
-   Flow:

    1. EmailConsole calls POST /api/email/send with {to, subject, body}.
    2. mockEngine validates and writes to Outbox (IndexedDB); generates trace (HELO..DATA..QUIT).
    3. A scheduler (setTimeout) simulates status changes and notifies via SSE.
    4. EmailConsole receives updates in real-time and refreshes list.

    3.2 External API Panel

-   services/apiService.ts: fetchRandomUser() → GET https://randomuser.me/api
-   components/ExternalApiPanel.tsx: UI to fetch and display user data; show loading, error, JSON.
-   No Service Worker interception for this domain (cross-origin pass-through).

    3.3 Socket Programming

-   SSE (default):
    -   Add /api/email/stream endpoint in sw.js that returns a ReadableStream, emitting events like "email-status" {id, status}.
    -   EmailConsole subscribes via EventSource and updates Outbox state.
-   WebSocket (optional):

    -   Node ws server (dev only) broadcasting email-status; SocketConsole UI for demo/chat.

    3.4 Data Layer: IndexedDB

-   Add services/idb.ts with a small wrapper (Dexie-like minimal API without dependency) or vanilla IndexedDB utilities:
    -   initDB(): open database, create object stores: projects, mocks, envVars, logs, outbox, inbox.
    -   CRUD utilities: getAll, get, put, delete, bulkPut.
-   Migration strategy:
    -   On first load, read existing LocalStorage keys and upsert into IndexedDB; set a MIGRATED flag.
    -   Keep LocalStorage writes in sync for backward compatibility initially (dual-write), then phase out.
-   Backup/Export:
    -   Export merges LocalStorage + IndexedDB collections into a single JSON for user download.

---

## 4. Detailed Design

4.1 Email Protocol Simulation

-   Validation rules (POST /api/email/send):
    -   Required: to (valid email), subject (non-empty), body (non-empty)
    -   If invalid: 400 with details
-   SMTP-like trace generation:
    -   [
        "220 localhost ESMTP Service Ready",
        "HELO backend.studio",
        "MAIL FROM:<noreply@backend.studio>",
        "RCPT TO:<${to}>",
        "DATA",
        ". (message body)",
        "250 OK: queued",
        "QUIT"
        ]
-   Status transitions:
    -   queued → sending (t+500ms) → delivered (t+1500ms)
    -   With small probability deliver fail: delivered|failed
-   SSE message schema:

    -   event: email-status
    -   data: { id, status, updatedAt }

    4.2 External API Integration

-   fetchRandomUser(): GET https://randomuser.me/api; map to { name, email, avatar }.
-   UI shows:

    -   Load button, spinner
    -   Result card with avatar + name + email
    -   Raw JSON toggle
    -   Error banner on failure

    4.3 SSE Endpoint (Service Worker)

-   In sw.js:

    -   If request to /api/email/stream: return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
    -   Maintain a list of connected clients (streams) in SW global scope
    -   On status change, write to each stream: `event: email-status\ndata: {json}\n\n`
    -   Heartbeat every 20–30 seconds to keep alive

    4.4 IndexedDB Wrapper

-   Schema v1:
    -   stores: projects (key id), mocks (key id), envVars (key id), logs (key id, idx by createdAt), outbox (key id), inbox (key id)
-   Functions:
    -   initDB(), getStore(name), put(store, obj), bulkPut(store, arr), getAll(store), getById(store, id), delete(store, id)
-   Migration:

    -   On app start: if !MIGRATED, read LocalStorage keys (api_sim_projects, api_sim_mocks, api_sim_env_vars, api_sim_logs?) and bulkPut into IndexedDB; set MIGRATED flag
    -   Dual-write phase: when app changes data, write both IDB and LocalStorage (temporary)

    4.5 UI Components

-   EmailConsole.tsx
    -   Form (to, subject, body), Send button
    -   Outbox list with status chips and protocol trace accordion
    -   Connects to SSE on mount; updates statuses live
-   ExternalApiPanel.tsx
    -   Fetch user button; result view
-   Navigation
    -   Add a sidebar entry “Email” and “External API” under Labs

---

## 5. Security & Privacy

-   All data stays local (IndexedDB/LocalStorage). No credentials are persisted by default.
-   External API calls are read-only and public (RandomUser). For APIs requiring keys, use user-provided keys in envVars, don’t hardcode.
-   SSE streams are local to your origin; no third-party socket connections unless user starts the optional WS server.

---

## 6. Testing Strategy

-   Unit-ish tests via scripts (like Task 2.2 helper):
    -   Email send flow: POST /api/email/send, then poll GET /api/email/status/:id until delivered; assert trace exists
    -   SSE: open EventSource and assert receiving email-status events
    -   IndexedDB: write/read roundtrip for outbox and mocks; migration from LocalStorage → IDB
-   Manual tests via UI:
    -   EmailConsole send + live updates
    -   External API panel fetch
    -   Restart app: data remains (IndexedDB)

---

## 7. Tasks & Milestones

Milestone A: External API Panel

-   [x] services/apiService.ts: fetchRandomUser
-   [x] components/ExternalApiPanel.tsx
-   [x] Sidebar entry + route
-   [x] Cache-busting and offline error handling

Milestone B: Email Protocol Simulation

-   [x] Email mocks in mockEngine/sw (POST send, GET status/:id, GET inbox)
-   [x] services/emailService.ts (SMTP trace, validation, scheduler)
-   [x] components/EmailConsole.tsx (form + outbox + trace viewer)
-   [x] Status scheduler (queued→sending→delivered/failed)
-   [x] Protocol trace rendering (expandable SMTP simulation)

Milestone C: Socket Programming (SSE)

-   [x] /api/email/stream in sw.js
-   [x] EventSource client in EmailConsole
-   [x] Broadcast status updates

Milestone D: IndexedDB Migration

-   [x] services/idb.ts wrapper
-   [x] init/migration from LocalStorage
-   [x] Dual-write for compatibility
-   [x] Viewer updates for IDB-backed data

**Completed:** Implemented IDB wrapper (see `services/indexedDB.ts`), migration flow, dual-write mirrors, and deterministic import handling (dispatching `backend-studio-imported`). Playwright E2E tests for import/export and the delete-then-import flow pass.

Docs

-   [ ] Update PRD/Architecture with the new modules (Email, External API, SSE, IDB)
-   [ ] Add a brief runbook and diagrams

---

## 8. Alternatives Considered

-   WebSocket vs SSE: chose SSE first due to simplicity (no external server); can add WS dev server later for chat.
-   Full SMTP vs Simulation: simulation provides learning outcome without infrastructure burden; optional hook-up to MailHog for bonus.
-   IndexedDB library vs vanilla: start with a small wrapper; if complexity grows, consider Dexie.

---

## 9. Risks & Mitigations

-   Service Worker streaming (SSE) compatibility: test on Chrome/Edge first; provide fallback to polling.
-   IDB complexity: start minimal; keep export/import to safeguard user data.
-   External API quota: RandomUser is generous; add backoff and error messages.

---

## 10. Acceptance Criteria

-   EmailConsole can send, list, and observe status updates live; trace displayed per message.
-   ExternalApiPanel can fetch and display data from RandomUser.
-   SSE stream endpoint works and pushes email-status events.
-   IndexedDB persists mocks/outbox across reloads; migration from LocalStorage completes once.
