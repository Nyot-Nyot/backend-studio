# Sprint Planning (Production-readiness)

This file is a sprint plan split into phases with detailed tasks derived from `docs/polish-analysist.md`. Each task is formatted as a checkbox ([ ]) for tracking.

---

## Konvensi Penulisan Kode ✅

**Tujuan:** Mencapai kode yang bersih, mudah dipelihara, terbaca, dan idiomatis. Seluruh teks milik kode — termasuk _nama variabel_, _nama fungsi_, _komentar_, dan _pesan UI_ — **harus berbahasa Indonesia**. Pengecualian: istilah teknis umum, nama pustaka, dan keyword bahasa pemrograman (mis. API, OAuth, token, React, TypeScript, Node.js) tetap dalam bahasa aslinya.

### Aturan Umum 🔧

-   **Gunakan Bahasa Indonesia konsisten** di semua nama lokal dan komentar. Contoh: `ambilData`, `simpanKeDatabase`, `KomponenEditor`.
-   **Ikuti gaya idiomatis** JavaScript/TypeScript: `camelCase` untuk variabel/fungsi, `PascalCase` untuk komponen/kelas, dan `kebab-case` untuk nama file jika diperlukan.
-   **Preferensi readability:** fungsi harus pendek dan melakukan satu tugas; bagi fungsi besar menjadi beberapa fungsi kecil yang mudah diuji.
-   **Tambahkan tipe eksplisit** di TypeScript untuk antarmuka publik; hindari `any` tanpa alasan kuat.

### Penamaan 📛

-   Variabel/fungsi: gunakan kata kerja bila beraksi (mis. `ambilData`, `tampilkanModal`), kata benda bila menyimpan data (mis. `daftarPengguna`, `konfigurasiApp`).
-   Komponen React: gunakan `PascalCase` dan nama deskriptif bahasa Indonesia (mis. `PanelDatabase`, `FormEmail`).
-   Hindari singkatan yang tidak jelas; jika perlu singkat, cantumkan penjelasan di komentar.

### Komentar & Dokumentasi 📝

-   Tulis komentar dalam Bahasa Indonesia yang jelas dan singkat.
-   Gunakan komentar untuk menjelaskan _mengapa_, bukan _apa_ — biarkan nama fungsi dan tipe menjelaskan _apa_.
-   Dokumen README, contoh penggunaan, dan pesan PR ditulis dalam Bahasa Indonesia (sertakan istilah teknis bila perlu).

### Struktur & Arsitektur 🔧

-   Pisahkan logika menjadi modul kecil dengan tanggung jawab tunggal (Single Responsibility).
-   Gunakan hook dan utilitas yang dapat diuji untuk memisahkan efek samping dari presentasi (mis. `useServiceWorker`, `usePersistentStorage`).
-   Hindari kebocoran detail implementasi melalui kontrak publik; prefer interface/tipe yang jelas.

### Testing ✅

-   Nama test case ditulis dalam Bahasa Indonesia (mis. `describe('Autentikasi', ...)`, `it('menolak permintaan tanpa token', ...)`).
-   Gunakan fixtures dan helper bersama (direktori `test/fixtures`) agar test mudah dibaca dan cepat dijalankan.

### Contoh singkat (baik vs buruk)

**Buruk**

```ts
// Bad: campuran bahasa Inggris, nama ambigu
const fetchData = async () => {
	/* ... */
};
// UI label
const submit = "Submit";
```

**Baik**

```ts
// Nama fungsi dan label berbahasa Indonesia, tipe eksplisit
const ambilDataDariServer = async (): Promise<DataResponse> => {
	/* ... */
};
const tombolKirim = "Kirim";
```

---

## Phase 0 — P0 (Critical, must-fix before production) — **Status: ✅ Selesai**

-   [x] Add Service Worker postMessage handshake helper with timeout and network fallback
-   [x] Update `sw.js` to use handshake helper and add unit tests for timeout/fallback
-   [x] Update `App.tsx` SW listener to use the robust handshake and graceful fallback path
-   [x] Add integration test simulating an unresponsive client to verify fallback behavior
-   [x] Make `dbService.saveCollection` optionally return a Promise / implement and document `persistCollectionAsync`
-   [x] Refactor import/export and factory-reset flows to await persistence before confirming completion
-   [x] Add integration tests for persistence across reloads (localStorage and indexedDB modes)
-   [x] Remove implicit API key pickup from `openrouterClient`; require explicit opt-in for client keys
-   [x] Enforce server-side API key handling in `scripts/openrouter-proxy.cjs` and add tests for missing/invalid key
-   [x] Harden input validation for proxy target, upload endpoints, and imported file formats; add tests for invalid inputs
-   [x] Add CI workflow (`.github/workflows/ci.yml`) that runs lint, type-check, unit tests, dependency audit, and e2e
-   [x] Add `npm run ci-local` to run CI steps locally during development

---

## Phase 1 — P1 (High priority)

-   [x] Replace critical `any` usage with explicit types in `types.ts`, `dbService`, and `mockEngine`
-   [x] Add tests to validate typed contracts (dbService, mockEngine)
-   [x] Add a logger abstraction and integrate across services; support env-driven verbosity
-   [x] Create `env.example` and document required VITE env variables; add runtime checks
-   [x] Run automated a11y scan (axe) and fix the top accessibility issues; add CI a11y guard
-   [x] Restrict CORS in `scripts/socket-server.cjs` for production and add payload validation + rate-limiting
-   [x] Mask tokens in MockEditor and provide copy-to-clipboard with confirmation (added e2e test)
-   [x] Add CSP recommendations and sample meta tag; document production hosting guidance
-   [x] Improve `openrouterClient.postJson` to opt-in header injection and add tests
-   [x] Add timeouts & backoff for key network calls (proxy, uploads, socket fallback)

---

## Phase 2 — P2 (Medium priority)

-   [ ] Virtualize long lists in `LogViewer` and `DatabaseView` (react-window) and add perf tests
-   [ ] Refactor `MockEditor` into smaller components + `useSchemaEditor` and `useDragDrop` hooks; add unit tests
-   [ ] Extract `App.tsx` side-effects into hooks: `useSocket`, `useServiceWorker`, `usePersistentStorage`
-   [ ] Validate generated `server.js` during export and provide `Dockerfile` template; add smoke test
-   [ ] Improve `exportService` with template file and syntax validation tests
-   [ ] Add streaming/size checks in `emailService` and `uploadService`; add graceful error handling
-   [ ] Add unit tests for `mockEngine` placeholder parser to avoid accidental replacements inside strings
-   [ ] Fix OpenAPI generator (null handling, configurable server url) and add tests
-   [ ] Replace fragile JSON highlighter in `TestConsole` with safer implementation and add tests

---

## Phase 3 — P3 (Long-term)

-   [ ] Full TypeScript `strict` migration plan and schedule
-   [ ] Add runtime metrics (request count, error rates) and plan observability (Prometheus/Grafana or SaaS)
-   [ ] Add user-facing docs: troubleshooting, FAQ, and migration guides
-   [ ] Automate dependency monitoring and upgrade policy
-   [ ] Plan security reviews and penetration testing before major releases

---

## Phase 4 — P4 (UI/UX Polish)

-   [ ] Lakukan audit alur pengguna end-to-end (user flows) untuk semua fitur inti, catat pain points dan friction utama
-   [ ] Buat checklist visual & UX: warna, tipografi, ikonografi, states (hover/focus/disabled), dan pola spacing yang konsisten
-   [ ] Terapkan design tokens (warna, spacing scale, radii, shadow) dan jadikan tema dapat dikonfigurasi (light/dark)
-   [ ] Standarisasi spacing yang _satisfying_ (definisikan scale, mis. 4 / 8 / 12 / 16 / 24 / 32) dan terapkan di komponen & layout
-   [ ] Konsolidasi dan refactor komponen UI (button, form, modal, notifikasi) untuk konsistensi, aksesibilitas, dan themability
-   [ ] Tambahkan micro-interactions dan transisi halus untuk feedback (klik, loading, sukses, error)
-   [ ] Perbarui Storybook / dokumentasi komponen dengan contoh tema, varian spacing, dan pattern penggunaan
-   [ ] Jalankan uji responsif dan lintas-browser; tambahkan visual regression tests (Percy / Chromatic / Playwright snapshot)
-   [ ] Lakukan usability testing (3–5 pengguna) untuk memvalidasi perbaikan alur dan kumpulkan umpan balik terprioritaskan
-   [ ] Pastikan aksesibilitas (keyboard navigation, focus order, contrast) dan perbaiki isu hasil scan a11y
-   [ ] Tetapkan acceptance criteria untuk setiap perubahan UI/UX dan masukkan ke release checklist

---

## Phase 5 — P5 (Penerapan Konvensi Kode Intensif)

-   [ ] Lakukan inventarisasi lengkap kode untuk menentukan cakupan (folder, file, komponen, layanan) yang perlu disesuaikan dengan konvensi
-   [ ] Tambahkan dan konfigurasikan aturan lint (ESLint) dan formatting (Prettier) khusus yang menegakkan penamaan dan bahasa Indonesia untuk string UI; buat daftar pengecualian tertulis
-   [ ] Buat skrip codemod (ts-morph / jscodeshift) untuk perubahan besar dan jalankan dalam batch kecil per direktori; setiap batch dibuatkan PR terpisah dengan changelog dan rencana rollback
-   [ ] Tambahkan job CI `konvensi-check` yang menjalankan lint, format-check, dan pengecekan string bahasa pada setiap PR; tolak PR yang melanggar aturan kritis
-   [ ] Terapkan pre-commit hook (husky) untuk menjalankan format & lint lokal sebelum commit, dan pre-push yang menjalankan subset test cepat
-   [ ] Refactor terukur: prioritaskan folder P0 (core services, sw.js, dbService) lalu UI, kemudian tests; buat checklist PR untuk setiap folder
-   [ ] Perbarui pesan UI, label, dan dokumentasi agar berbahasa Indonesia sesuai aturan (kecuali istilah teknis yang dikecualikan)
-   [ ] Ganti nama test-cases dan fixtures ke Bahasa Indonesia; tambahkan test yang memastikan string UI tidak mengandung bahasa Inggris selain daftar pengecualian
-   [ ] Buat dokumen `docs/konvensi-kode.md` lengkap (versi final) dan feedback loop (issue template untuk request pengecualian atau klarifikasi)
-   [ ] Lakukan review dan pelatihan singkat (brown bag / workshop) untuk tim agar konvensi dipahami dan diikuti
-   [ ] Tetapkan acceptance criteria untuk Phase 5: semua job `konvensi-check` lulus pada branch `main`, >95% file yang diikutsertakan telah diproses, tidak ada `any` kritis yang belum didokumentasikan/diizinkan, tests & snapshots lulus, dan semua PR-nya ter-review oleh code owners

---

## Cross-cutting & Maintenance Tasks

-   [ ] Add ESLint / Prettier config and enforce via pre-commit hooks + CI
-   [ ] Clean tests: remove noisy `console.log`, replace custom asserts with standard assertions, and add global cleanup helpers
-   [ ] Create test fixtures directory and document test helper API
-   [ ] Add snapshot/lint checks for generated outputs (OpenAPI, server.js)
-   [ ] Add `--quiet` flag option to dev servers that log sensitive info (email-helper, openrouter-proxy)
-   [ ] Add changelog template and release notes process

---

## Sprint plan notes

-   Start with Phase 0 tasks; implement the SW handshake timeout first (low risk, high impact) then proceed to persistence and API key fixes.
-   Each major task should be split into smaller PR-level steps (design, implement, tests, docs, release notes) and be tracked individually as cards in your project board.
-   I can take ownership of the first implementation (SW timeout + tests) and open a PR with tests and changelog entry if you want.

---

(Generated from `docs/polish-analysist.md` — all items were included and mapped into sprint phases.)
