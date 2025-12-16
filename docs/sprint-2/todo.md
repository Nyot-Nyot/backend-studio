## Sprint 2 – Stateful Mocking, Auth, & Export Backend (Tracking)

-   **Horizon:** 1 minggu (lanjutan setelah Sprint 1)
-   **Goal sprint:** CRUD stateful berjalan, simulasi autentikasi berfungsi, dan export Node.js/Express + OpenAPI bisa dijalankan/divalidasi tanpa error.
-   **Acceptance criteria umum (dari sprint-planning):**
    -   CRUD stateful berjalan dari endpoint mock → LocalStorage → DatabaseView.
    -   Simulasi authentication berfungsi dan bisa didemokan dari Test Console.
    -   Export `server.js` (Express) dan `openapi.json` bisa dijalankan/divalidasi tanpa error.

> Estimasi waktu bersifat kasar; update saat daily jika berubah.

---

### Epic E4 – Stateful Mocking & Database View

-   [ ] **Task 4.1 – Verifikasi & perkuat `dbService`** (2–3 jam)

    -   [ ] Uji CRUD end-to-end:
        -   [ ] `getCollection`, `insert`, `update`, `delete`.
        -   [ ] Auto‑ID: numeric auto‑increment atau UUID pendek sesuai kondisi existing data.
    -   [ ] Pastikan tipe ID (`string`/`number`) ditangani dengan loose compare (`==`).
    -   Acceptance: Operasi CRUD konsisten dan tidak duplikat/korup di LocalStorage.

-   [ ] **Task 4.2 – Uji alur stateful di `simulateRequest`** (3–4 jam)

    -   [ ] Dengan `storeName` terisi:
        -   [ ] `GET` tanpa param → kembalikan seluruh koleksi.
        -   [ ] `GET` dengan param → kembalikan item by id, atau `404` jika tidak ada.
        -   [ ] `POST` → parse body JSON, insert, kembalikan item baru (validasi JSON).
        -   [ ] `PUT/PATCH` → update by id; `404` jika tidak ada; `400` jika JSON invalid.
        -   [ ] `DELETE` → hapus by id; `200` jika sukses; `404` jika tidak ada.
    -   Acceptance: Semua method CRUD mengembalikan status & body sesuai skenario; error ditangani (400/404).

-   [ ] **Task 4.3 – Implementasi `DatabaseView`** (3–4 jam)
    -   [ ] Tampilkan:
        -   [ ] Daftar nama koleksi dari `dbService.listCollections()`.
        -   [ ] Isi koleksi dalam bentuk tabel/list JSON.
    -   [ ] Aksi:
        -   [ ] Tombol delete per item.
        -   [ ] Tombol “Clear collection”.
        -   [ ] (Opsional) Tombol “Clear all DB”.
    -   Acceptance: Perubahan di DatabaseView tercermin di LocalStorage; operasi tidak mempengaruhi koleksi lain.

---

### Epic E5 – Authentication Simulation

-   [ ] **Task 5.1 – Pengujian logika auth di `simulateRequest`** (2–3 jam)

    -   [ ] `BEARER_TOKEN`:
        -   [ ] Header dicek: `Authorization: Bearer <token>`.
        -   [ ] Jika salah/tidak ada → `401 Unauthorized`.
    -   [ ] `API_KEY`:
        -   [ ] Header dicek: `authConfig.headerKey` (default `x-api-key`).
        -   [ ] Jika salah/tidak ada → `401 Unauthorized`.
    -   Acceptance: Semua skenario auth menghasilkan status yang tepat (200 vs 401) sesuai token/kunci.

-   [ ] **Task 5.2 – UX Auth di `MockEditor`** (2 jam)

    -   [ ] Dropdown `Auth Type`: `NONE`, `BEARER_TOKEN`, `API_KEY`.
    -   [ ] Input:
        -   [ ] `headerKey` (untuk API key).
        -   [ ] `token` (nilai yang dicocokkan).
    -   [ ] Teks penjelas singkat di UI (contoh header yang harus diisi).
    -   Acceptance: User dapat menyimpan konfigurasi auth; nilai header yang diharapkan jelas di UI.

-   [ ] **Task 5.3 – Skenario uji** (2 jam)
    -   [ ] Endpoint `NONE` → semua request lolos.
    -   [ ] Endpoint Bearer:
        -   [ ] Tanpa header → 401.
        -   [ ] Header salah → 401.
        -   [ ] Header benar → 200 / sesuai `statusCode`.
    -   [ ] Endpoint API key:
        -   [ ] Tanpa header → 401.
        -   [ ] Header salah → 401.
        -   [ ] Header benar → 200 / sesuai `statusCode`.
    -   Acceptance: Semua kombinasi uji di atas sesuai harapan tanpa regresi fitur lain.

---

### Epic E6 – Export Node.js Server & OpenAPI

-   [ ] **Task 6.1 – Review & perkuat `generateServerCode`** (2–3 jam)

    -   [ ] Mapping:
        -   [ ] Method → `app.get/post/put/delete/...`.
        -   [ ] Path → `mock.path`.
        -   [ ] Status → `mock.statusCode`.
        -   [ ] Body → `mock.responseBody` (valid JSON).
    -   [ ] Tambahkan:
        -   [ ] Middleware `express.json()`, `cors()`.
        -   [ ] Logging sederhana (`console.log(method, path, status)`).
    -   Acceptance: `server.js` hasil export berjalan lokal tanpa error dan melayani route sesuai definisi.

-   [ ] **Task 6.2 – Uji nyata hasil export** (2–3 jam)

    -   [ ] Download `server.js` + `package.json`.
    -   [ ] Jalankan:
        -   [ ] `npm install`.
        -   [ ] `node server.js`.
    -   [ ] Panggil route dari Postman/cURL, cocokkan dengan definisi di UI.
    -   Acceptance: Semua route aktif merespon sesuai konfigurasi mock; tidak ada crash di startup/runtime.

-   [ ] **Task 6.3 – Review `openApiService`** (2–3 jam)

    -   [ ] Mapping `MockEndpoint` → OpenAPI:
        -   [ ] `paths[path][method]`.
        -   [ ] `responses[statusCode].description` + `content['application/json']`.
    -   [ ] (Opsional) Schema/example dari `responseBody` jika memungkinkan.
    -   Acceptance: `openapi.json` valid (lolos Swagger Editor) dan memuat semua endpoint aktif.

-   [ ] **Task 6.4 – Uji `openapi.json`** (1–2 jam)
    -   [ ] Export via UI.
    -   [ ] Buka di Swagger Editor (`editor.swagger.io`).
    -   Acceptance: File bisa diimpor tanpa error, menampilkan endpoint sesuai definisi.

---

## Catatan Harian (isi saat eksekusi)

-   Day 1: …
-   Day 2: …
-   Blockers/Risiko: …

---

## Referensi

-   `docs/sprint-planning.md` (Sprint 2 – Stateful Mocking, Auth, & Export Backend)
-   `docs/prd.md`
-   `docs/architect.md`
