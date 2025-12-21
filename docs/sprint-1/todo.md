## Sprint 1 – Core Engine & Service Worker (Tracking)

-   **Horizon:** 1 minggu (target siap Senin)
-   **Goal sprint:** Alur `HTTP request → Service Worker → mockEngine → response` berfungsi end-to-end dan dapat dites dari UI (Test Console), dengan logging yang tercatat.
-   **Acceptance criteria umum (dari sprint-planning):**
    -   SW aktif dan memotong request ke endpoint mock.
    -   `simulateRequest` terpakai end‑to‑end dari SW dan menghasilkan response yang sesuai PRD.
    -   Test Console bisa mengirim request dan menampilkan response dengan benar.
    -   Log request muncul di `LogViewer`.

> Estimasi waktu bersifat kasar; jika lebih cepat/lebih lama, update di sini saat daily.

---

### Epic E1 – Service Worker Interceptor

-   [x] **Task 1.1 – Implementasi & perapian `sw.js`** (3–4 jam)

    -   [x] Tambah handler `install` & `activate` (skipWaiting + clients.claim).
    -   [x] Handler `fetch`:
        -   [x] Filter hanya request API (hindari file statis, HMR, assets).
        -   [x] Buat `MessageChannel`, kirim `{ method, url, headers, body }` ke client.
        -   [x] Terima response dari React (hasil `simulateRequest`), balas sebagai `Response` dengan status/body/headers, hormati `delay`.
    -   Acceptance: SW mengembalikan response dari mockEngine, non-API request tidak diintercept. ✅

    -   Note: Implemented filter to only intercept `/api/*`, added robust HMR/static exclusions, and added a default `/api/ping` mock for smoke testing.

    -   **Verification checklist (manual)**:
        -   Check Service Worker registration: `navigator.serviceWorker.getRegistration()` or Application → Service Workers in DevTools.
        -   `GET /api/ping` should return 200 with JSON body `{ "pong": true }` and header `X-Powered-By: BackendStudio`.
        -   Non-API requests (e.g., `/index.html`) should **not** be intercepted by the SW (no `X-Powered-By` header from mock, and Network shows normal response).
        -   Create a custom mock (e.g., `POST /api/users` with `delay: 500`) via Mock Editor, submit a request from Test Console or `fetch`, and verify response status/body/delay and that a log entry appears in `LogViewer`.
        -   If any behavior differs, collect browser Console and Network traces and report back for debugging.

-   [x] **Task 1.2 – Registrasi Service Worker di React** (1–2 jam)

    -   [x] Daftarkan SW di `index.tsx`/`App.tsx`.
    -   [x] Logging sederhana untuk success/fail register.
    -   [x] Pastikan SW aktif sebelum trafik utama (uji reload setelah install).
    -   Acceptance: SW terdaftar, status terlihat di console, tidak mengganggu UI. ✅

-   [x] **Task 1.3 – Uji manual alur intercept** (2 jam)

    -   [x] Buat 1–2 route mock sederhana (`GET /api/ping`, `POST /api/users`).
    -   [x] Kirim request via DevTools `fetch` dan Test Console.
    -   [x] Verifikasi response berasal dari `simulateRequest`, sesuai status/body.
    -   Acceptance: Request API terlihat di Network tab sebagai “from SW”, respon sesuai mock. ✅

    -   Note: Initial POST returned 404 on first try because no active mock matched ("No active route found for POST /api/users"); after creating/activating the POST `/api/users` mock with response template `{"id":"{{@body.id}}","name":"{{@body.name}}"}`, a retry returned 200 with injected values. To reproduce/debug, use the console commands shown in the verification checklist to inspect stored mocks (`localStorage.getItem('api_sim_mocks')`).

---

### Epic E2 – Integrasi `simulateRequest` + Logging

-   [x] **Task 2.1 - Verifikasi integrasi di `App.tsx`** (1-2 jam)

    -   [x] Listener `navigator.serviceWorker.addEventListener('message', ...)` memanggil `simulateRequest` dengan `mocksRef` & `envVarsRef`.
    -   [x] Hasil `SimulationResult` ditambah ke state `logs`.
    -   Acceptance: Log baru muncul setiap ada request yang diintercept.

-   [x] **Task 2.2 – Uji kasus utama `simulateRequest`** (3–4 jam)
    -   [x] Path & query: `GET /api/users/123?active=true&page=2` cocok dengan `/api/users/:id`.
    -   [x] Variable injection: `{{@param.id}}` → `123`, `{{@query.page}}` → `2`.
    -   [x] Dynamic generators:
        -   [x] Placeholder bawaan: `{{$uuid}}`, `{{$randomEmail}}`, `{{$isoDate}}`, dll.
        -   [x] **Integrasi faker.js**: tambahkan placeholder baru (misal `{{$fakerName}}`, `{{$fakerEmail}}`, `{{$fakerCity}}`) yang menghasilkan data dummy acak; dokumentasikan di `MOCK_VARIABLES_HELP`.
    -   [x] Header default: `Content-Type: application/json`, `X-Powered-By: BackendStudio`.
    -   Acceptance: Semua placeholder bekerja, data dummy acak muncul konsisten, headers dan status sesuai definisi mock.

---

### Epic E3 – Test Console (HTTP Client Internal)

-   [x] **Task 3.1 – Lengkapi fungsi utama `TestConsole`** (2–3 jam)

    -   [x] Form pilih HTTP method, path (manual atau pilih dari mocks aktif), body JSON (POST/PUT/PATCH).
    -   [x] Submit menggunakan `fetch` ke URL yang diisi (melewati SW).
    -   [x] Tampilkan hasil: status code, headers, body, waktu eksekusi.
    -   Acceptance: Bisa mengirim request ke mock, melihat response lengkap di UI.

-   [x] **Task 3.2 – Integrasi dengan log & UX dasar** (1–2 jam)
    -   [x] Pastikan request dari Test Console otomatis tercatat di `logs`.
    -   [x] Tambah tombol “Run” dan “Re-run last request”.
    -   [x] Tampilkan error jelas jika `fetch` gagal (network/JSON parse).
    -   Acceptance: Log bertambah setiap klik “Run”; error tampil bila request gagal.

---

## Catatan Harian (isi saat eksekusi)

-   Day 1: Implemented Task 1.1 — added install/activate handlers and robust fetch interceptor (only `/api/*`, excludes HMR/static), added MessageChannel/id payload, and a default `/api/ping` mock for smoke testing.
-   Day 2: Fixed SW response handling (headers/body stringify and error fallback). Awaiting verification of `/api/ping` and POST `/api/users` behavior from browser tests.
-   Blockers/Risiko: …

---

## Referensi

-   `docs/sprint-planning.md` (Sprint 1 – Core Engine & Service Worker)
-   `docs/prd.md` (Functional & Non-functional requirements)
-   `docs/architect.md` (Arsitektur & tech stack)

---

### Cross-sprint notes

-   **Sprint 3 – Epic E7 (MockEditor polishing)**
    -   [x] Added Playwright e2e tests for **Route conflict detection** and **JSON validation / Syntax Error** (`test/e2e/mockEditor-validation.spec.ts`).
    -   [x] Verified Save is disabled when `conflictError` or `jsonError` is present and proper toast messages are shown.
    -   [x] Expanded tests to cover: Format button behaviour, error line highlighting, array/object roundtrip, and visual→code two-way sync.
    -   [x] Added Playwright e2e tests for Export/Import/Factory Reset (`test/e2e/export-import.spec.ts`) and verified successful behavior and error handling (tests executed locally and passed).
    -   [x] Added Playwright layout/responsiveness tests for Chromium and verified multiple viewports (1366×768, 1440×900, 768×1024) passed; automated Firefox runs also passed; WebKit blocked due to missing system deps in this environment.

(Tasks related to Mode sync, Format JSON button & nested conversion still ongoing in Sprint 3.)
