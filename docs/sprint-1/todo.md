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

-   [ ] **Task 1.1 – Implementasi & perapian `sw.js`** (3–4 jam)

    -   [ ] Tambah handler `install` & `activate` (skipWaiting + clients.claim).
    -   [ ] Handler `fetch`:
        -   [ ] Filter hanya request API (hindari file statis, HMR, assets).
        -   [ ] Buat `MessageChannel`, kirim `{ method, url, headers, body }` ke client.
        -   [ ] Terima response dari React (hasil `simulateRequest`), balas sebagai `Response` dengan status/body/headers, hormati `delay`.
    -   Acceptance: SW mengembalikan response dari mockEngine, non-API request tidak diintercept.

-   [ ] **Task 1.2 – Registrasi Service Worker di React** (1–2 jam)

    -   [ ] Daftarkan SW di `index.tsx`/`App.tsx`.
    -   [ ] Logging sederhana untuk success/fail register.
    -   [ ] Pastikan SW aktif sebelum trafik utama (uji reload setelah install).
    -   Acceptance: SW terdaftar, status terlihat di console, tidak mengganggu UI.

-   [ ] **Task 1.3 – Uji manual alur intercept** (2 jam)
    -   [ ] Buat 1–2 route mock sederhana (`GET /api/ping`, `POST /api/users`).
    -   [ ] Kirim request via DevTools `fetch` dan Test Console.
    -   [ ] Verifikasi response berasal dari `simulateRequest`, sesuai status/body.
    -   Acceptance: Request API terlihat di Network tab sebagai “from SW”, respon sesuai mock.

---

### Epic E2 – Integrasi `simulateRequest` + Logging

-   [ ] **Task 2.1 – Verifikasi integrasi di `App.tsx`** (1–2 jam)

    -   [ ] Listener `navigator.serviceWorker.addEventListener('message', ...)` memanggil `simulateRequest` dengan `mocksRef` & `envVarsRef`.
    -   [ ] Hasil `SimulationResult` ditambah ke state `logs`.
    -   Acceptance: Log baru muncul setiap ada request yang diintercept.

-   [ ] **Task 2.2 – Uji kasus utama `simulateRequest`** (3–4 jam)
    -   [ ] Path & query: `GET /api/users/123?active=true&page=2` cocok dengan `/api/users/:id`.
    -   [ ] Variable injection: `{{@param.id}}` → `123`, `{{@query.page}}` → `2`.
    -   [ ] Dynamic generators:
        -   [ ] Placeholder bawaan: `{{$uuid}}`, `{{$randomEmail}}`, `{{$isoDate}}`, dll.
        -   [ ] **Integrasi faker.js**: tambahkan placeholder baru (misal `{{$fakerName}}`, `{{$fakerEmail}}`, `{{$fakerCity}}`) yang menghasilkan data dummy acak; dokumentasikan di `MOCK_VARIABLES_HELP`.
    -   [ ] Header default: `Content-Type: application/json`, `X-Powered-By: BackendStudio`.
    -   Acceptance: Semua placeholder bekerja, data dummy acak muncul konsisten, headers dan status sesuai definisi mock.

---

### Epic E3 – Test Console (HTTP Client Internal)

-   [ ] **Task 3.1 – Lengkapi fungsi utama `TestConsole`** (2–3 jam)

    -   [ ] Form pilih HTTP method, path (manual atau pilih dari mocks aktif), body JSON (POST/PUT/PATCH).
    -   [ ] Submit menggunakan `fetch` ke URL yang diisi (melewati SW).
    -   [ ] Tampilkan hasil: status code, headers, body, waktu eksekusi.
    -   Acceptance: Bisa mengirim request ke mock, melihat response lengkap di UI.

-   [ ] **Task 3.2 – Integrasi dengan log & UX dasar** (1–2 jam)
    -   [ ] Pastikan request dari Test Console otomatis tercatat di `logs`.
    -   [ ] Tambah tombol “Run” dan “Re-run last request”.
    -   [ ] Tampilkan error jelas jika `fetch` gagal (network/JSON parse).
    -   Acceptance: Log bertambah setiap klik “Run”; error tampil bila request gagal.

---

## Catatan Harian (isi saat eksekusi)

-   Day 1: …
-   Day 2: …
-   Blockers/Risiko: …

---

## Referensi

-   `docs/sprint-planning.md` (Sprint 1 – Core Engine & Service Worker)
-   `docs/prd.md` (Functional & Non-functional requirements)
-   `docs/architect.md` (Arsitektur & tech stack)
