## Sprint 2 – Stateful Mocking, Auth, & Export Backend (Tracking)

- **Horizon:** 1 minggu (lanjutan setelah Sprint 1)
- **Goal sprint:** CRUD stateful berjalan, simulasi autentikasi berfungsi, dan export Node.js/Express + OpenAPI bisa dijalankan/divalidasi tanpa error.
- **Acceptance criteria umum (dari sprint-planning):**
  - CRUD stateful berjalan dari endpoint mock → LocalStorage → DatabaseView.
  - Simulasi authentication berfungsi dan bisa didemokan dari Test Console.
  - Export `server.js` (Express) dan `openapi.json` bisa dijalankan/divalidasi tanpa error.

> Estimasi waktu bersifat kasar; update saat daily jika berubah.

---

### Epic E4 – Stateful Mocking & Database View

- [x] **Task 4.1 – Verifikasi & perkuat `dbService`** (2–3 jam) ✅ COMPLETE

  - [x] Uji CRUD end-to-end:
    - [x] `getCollection`, `insert`, `update`, `delete`.
    - [x] Auto‑ID: numeric auto‑increment atau UUID pendek sesuai kondisi existing data.
  - [x] Pastikan tipe ID (`string`/`number`) ditangani dengan loose compare (`==`).
  - Acceptance: Operasi CRUD konsisten dan tidak duplikat/korup di LocalStorage. ✅

- [x] **Task 4.2 – Uji alur stateful di `simulateRequest`** (3–4 jam) ✅ COMPLETE

  - [x] Dengan `storeName` terisi:
    - [x] `GET` tanpa param → kembalikan seluruh koleksi.
    - [x] `GET` dengan param → kembalikan item by id, atau `404` jika tidak ada.
    - [x] `POST` → parse body JSON, insert, kembalikan item baru (validasi JSON).
    - [x] `PUT/PATCH` → update by id; `404` jika tidak ada; `400` jika JSON invalid.
    - [x] `DELETE` → hapus by id; `200` jika sukses; `404` jika tidak ada.
  - Acceptance: Semua method CRUD mengembalikan status & body sesuai skenario; error ditangani (400/404). ✅ **21/21 tests passing**

- [x] **Task 4.3 – Implementasi `DatabaseView`** (3–4 jam) ✅ COMPLETE

  - [x] Tampilkan:
    - [x] Daftar nama koleksi dari `dbService.listCollections()`.
    - [x] Isi koleksi dalam bentuk tabel/list JSON.
  - [x] Aksi:
    - [x] Tombol delete per item.
    - [x] Tombol "Clear collection".
    - [x] (Opsional) Tombol "Clear all DB".
  - Acceptance: Perubahan di DatabaseView tercermin di LocalStorage; operasi tidak mempengaruhi koleksi lain. ✅ **17/17 tests passing**

---

### Epic E5 – Authentication Simulation

- [ ] **Task 5.1 – Pengujian logika auth di `simulateRequest`** (2–3 jam)

  - [ ] `BEARER_TOKEN`:
    - [ ] Header dicek: `Authorization: Bearer <token>`.
    - [ ] Jika salah/tidak ada → `401 Unauthorized`.
  - [ ] `API_KEY`:
    - [ ] Header dicek: `authConfig.headerKey` (default `x-api-key`).
    - [ ] Jika salah/tidak ada → `401 Unauthorized`.
  - Acceptance: Semua skenario auth menghasilkan status yang tepat (200 vs 401) sesuai token/kunci.

- [ ] **Task 5.2 – UX Auth di `MockEditor`** (2 jam)

  - [ ] Dropdown `Auth Type`: `NONE`, `BEARER_TOKEN`, `API_KEY`.
  - [ ] Input:
    - [ ] `headerKey` (untuk API key).
    - [ ] `token` (nilai yang dicocokkan).
  - [ ] Teks penjelas singkat di UI (contoh header yang harus diisi).
  - Acceptance: User dapat menyimpan konfigurasi auth; nilai header yang diharapkan jelas di UI.

- [ ] **Task 5.3 – Skenario uji** (2 jam)
  - [ ] Endpoint `NONE` → semua request lolos.
  - [ ] Endpoint Bearer:
    - [ ] Tanpa header → 401.
    - [ ] Header salah → 401.
    - [ ] Header benar → 200 / sesuai `statusCode`.
  - [ ] Endpoint API key:
    - [ ] Tanpa header → 401.
    - [ ] Header salah → 401.
    - [ ] Header benar → 200 / sesuai `statusCode`.
  - Acceptance: Semua kombinasi uji di atas sesuai harapan tanpa regresi fitur lain.

---

### Epic E6 – Export Node.js Server & OpenAPI

- [x] **Task 6.1 – Review & perkuat `generateServerCode`** (2–3 jam) ✅ COMPLETE

  - Implementasi: Ekstraksi ke `services/exportService.ts`, validasi `responseBody` sebagai JSON literal, tambahkan `cors()` & `express.json()`, dan logging (per-route + middleware).
  - Tests: `test/generateServer.test.ts` menambahkan verifikasi middleware, logger, route mapping, dan body inlining.

  - [ ] Mapping:
    - [ ] Method → `app.get/post/put/delete/...`.
    - [ ] Path → `mock.path`.
    - [ ] Status → `mock.statusCode`.
    - [ ] Body → `mock.responseBody` (valid JSON).
  - [ ] Tambahkan:
    - [ ] Middleware `express.json()`, `cors()`.
    - [ ] Logging sederhana (`console.log(method, path, status)`).
  - Acceptance: `server.js` hasil export berjalan lokal tanpa error dan melayani route sesuai definisi.

- [x] **Task 6.2 – Uji nyata hasil export** (2–3 jam) ✅ COMPLETE

  - Implementasi: `test/task6_2_export_test.ts` mengotomatisasi end-to-end testing:
    1. Generate `server.js` dan `package.json` dengan sample mocks (6 endpoint: GET/POST/PUT/DELETE).
    2. Run `npm install` dan `node server.js` secara programmatic.
    3. Test 6 endpoint dengan Node.js http module (avoid PowerShell quoting issues).
    4. Verify status codes, response bodies, dan console logs (method, path, status).
  - Result: ✅ **6/6 tests passed** – server runs without errors, all routes respond correctly, logging works.
  - Acceptance: Semua route aktif merespon sesuai konfigurasi mock; tidak ada crash di startup/runtime. ✅

- [ ] **Task 6.3 – Review `openApiService`** (2–3 jam)

  - [ ] Mapping `MockEndpoint` → OpenAPI:
    - [ ] `paths[path][method]`.
    - [ ] `responses[statusCode].description` + `content['application/json']`.
  - [ ] (Opsional) Schema/example dari `responseBody` jika memungkinkan.
  - Acceptance: `openapi.json` valid (lolos Swagger Editor) dan memuat semua endpoint aktif.

- [ ] **Task 6.4 – Uji `openapi.json`** (1–2 jam)
  - [ ] Export via UI.
  - [ ] Buka di Swagger Editor (`editor.swagger.io`).
  - Acceptance: File bisa diimpor tanpa error, menampilkan endpoint sesuai definisi.

---

## Catatan Harian (isi saat eksekusi)

- Day 1: …
- Day 2: …
- Blockers/Risiko: …

---

## Referensi

- `docs/sprint-planning.md` (Sprint 2 – Stateful Mocking, Auth, & Export Backend)
- `docs/prd.md`
- `docs/architect.md`
