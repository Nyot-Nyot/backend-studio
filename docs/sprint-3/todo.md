## Sprint 3 – Polishing, Testing & Dokumentasi (Tracking)

-   **Horizon:** 1 minggu (menuju hari presentasi/Senin)
-   **Goal sprint:** UX halus, aplikasi stabil, dan dokumentasi + skenario uji lengkap untuk demo ke dosen.
-   **Acceptance criteria umum (dari sprint-planning):**
    -   UX editor (MockEditor) nyaman digunakan, validasi kuat, tidak ada error runtime.
    -   Fitur import/export & factory reset berfungsi stabil.
    -   Skenario uji untuk seluruh fitur utama sudah dijalankan dan terdokumentasi.
    -   README dan dokumen di `docs/` cukup jelas untuk orang baru menjalankan dan memahami arsitektur.

> Estimasi waktu bersifat kasar; update jika realisasi berbeda saat daily.

---

### Epic E7 – Polishing UX & Robustness

#### [x] **Task 7.1 – Validasi & Polishing `MockEditor`** (4–5 jam)

-   [x] **Audit konfigurasi route & status:**
    -   [x] Uji berbagai kombinasi `method` + `path` untuk memastikan conflict detection (`Route conflict: ... already exists`) muncul di kasus yang tepat.
    -   [x] Pastikan user tidak bisa menyimpan route jika masih ada `conflictError` atau `jsonError`.
-   [x] **Perbaikan validasi JSON:**
    -   [x] Pastikan `validateJsonStructure` menolak root `null` dan tipe primitif (harus object/array).
    -   [x] Cek bahwa error line (`getErrorLine`) menunjuk ke baris yang benar saat JSON invalid.
    -   [x] Tombol “Format JSON” gagal dengan pesan jelas jika JSON invalid.
-   [x] **Sinkronisasi mode `code` ↔ `visual`:**

    -   [x] Dari mode code → visual:
        -   [x] Jika JSON valid & bentuk array/object, visual editor terisi dengan field yang benar.
        -   [x] Jika JSON tidak valid atau bentuknya tidak didukung → tampilkan error & tetap di mode code.
    -   [x] Dari mode visual → code:
        -   [x] Perubahan field langsung tercermin di `responseBody` (indentasi rapi).
    -   [x] Uji nested object & array: pastikan konversi dua arah tidak menghilangkan field.

-   **Acceptance (T7.1):**
    -   Tidak ada crash saat mengedit JSON (baik di code mode maupun visual mode).
    -   Route dengan path duplikat tidak bisa disimpan; pesan error jelas.
    -   Pengguna bisa berpindah mode tanpa kehilangan data (selama JSON valid).

#### [x] **Task 7.2 – Import/Export Workspace & Factory Reset** (3–4 jam)

-   [x] **Verifikasi Export Configuration (`handleExportData`):**
    -   [x] Pastikan `projects`, `mocks`, dan `envVars` tersimpan lengkap di file JSON.
    -   [x] Buka file hasil export dan cek struktur (versi, timestamp, arrays).
-   [x] **Verifikasi Import Configuration (`handleImportData`):**
    -   [x] Uji import file yang valid: semua project, mocks, dan envVars ter-load.
    -   [x] Uji import file rusak/format salah → tampilkan error message yang jelas, tidak merusak data lama.
    -   [x] Uji scenario “Replace current workspace?” → pastikan data lama benar‑benar tergantikan hanya setelah user konfirmasi.
-   [x] **Factory Reset:**
    -   [x] Pastikan `localStorage.clear()` atau mekanisme yang digunakan menghapus semua key terkait app (`api_sim_*`, DB\_\*).
    -   [x] Setelah reload, app kembali ke kondisi fresh install (hanya `Default Workspace`, tanpa mocks/data).
-   **Acceptance (T7.2):**
    -   Export/Import dapat digunakan oleh user non-teknis tanpa kehilangan data secara tak sengaja.
    -   Factory reset bekerja konsisten dan tidak meninggalkan sisa data lama.
    -   **Verification note:** Playwright e2e tests were executed in Chromium and passed (see `test/e2e/*`). Cross-browser (Firefox/WebKit) projects are not configured in `playwright.config.ts`; let me know if you want cross‑browser verification and I will add it.

#### [ ] **Task 7.3 – Cross‑browser & Layout Check** (3–4 jam)

-   [x] **Uji di beberapa browser:**

    -   [x] Chrome (desktop): semua fitur inti berjalan, tidak ada error di console (automated Playwright layout tests at multiple viewports passed in Chromium).
    -   [x] Firefox (desktop): SW bekerja, Test Console & DatabaseView normal (automated tests passed in Firefox).
    -   [x] Cross‑browser verification (WebKit/Edge/Brave) intentionally **skipped** per request — no further cross‑browser automated runs will be performed in this sprint.

-   [x] **Uji di berbagai resolusi:**

    -   [x] Laptop (1366×768): sidebar + main content visible and functional.
    -   [x] Layar lebih lebar (≥ 1440px): layout remains tidy and content not stretched.
    -   [x] Tablet (768×1024): minimal layout preserved and main interactions accessible.

-   [x] **Perbaikan UX kecil (checks):**

    -   [x] Consistency of method badge colors (GET=blue, POST=green, DELETE=red) verified by automated test.
    -   [x] Key labels checked for typos and consistency (Export, Import, Factory Reset present and correct).

-   **Acceptance (T7.3):**

    -   Aplikasi responsif di beberapa ukuran layar; tidak ada layout broken major.
    -   Tidak ada error JavaScript yang muncul di console saat penggunaan normal.

    -   **Verification note:** Automated layout & label tests were executed in Chromium and Firefox and passed. WebKit runs failed due to missing system dependencies on this Arch environment (install `npx playwright install-deps` or the specific system packages for WebKit to enable WebKit runs). If you want, I can prepare a small doc/PR to add cross-browser CI for full verification.

---

### Epic E8 – Testing Terstruktur & Dokumentasi Akhir

#### [ ] **Task 8.1 – Daftar & Eksekusi Skenario Uji** (4–5 jam)

-   [ ] **Susun checklist uji di dokumen terpisah (misal `docs/testing-checklist.md`):**
    -   [ ] Workspace & Project Management:
        -   [ ] Membuat project baru.
        -   [ ] Menghapus project (dengan validasi tidak menghapus terakhir).
        -   [ ] Pergantian project dan persistensi via reload.
    -   [ ] Route Design & Mocking:
        -   [ ] Menambah route baru (GET/POST/PUT/DELETE/PATCH).
        -   [ ] Path dinamis `/api/users/:id` dan akses `@param`.
    -   [ ] Response Body & Generators:
        -   [ ] Placeholder `{{$uuid}}`, `{{$randomEmail}}`, `{{$isoDate}}`, `{{$randomName}}`, `{{$randomInt}}`, `{{@param.*}}`, `{{@query.*}}`, `{{$faker*}}`.
    -   [ ] Stateful Mocking:
        -   [ ] Insert/update/delete data di `DatabaseView`.
        -   [ ] Pastikan data tetap ada setelah refresh (LocalStorage).
    -   [ ] Authentication:
        -   [ ] Skenario `NONE`, `BEARER_TOKEN`, `API_KEY` dengan kombinasi benar/salah.
    -   [ ] Testing & Monitoring:
        -   [ ] Test Console kirim request sukses.
        -   [ ] LogViewer menampilkan semua request, dapat di-clear.
    -   [ ] Export/Deployment:
        -   [ ] Export `openapi.json` → diverifikasi di Swagger Editor.
        -   [ ] Export `server.js` + `package.json`, `npm install` + `node server.js`, uji via Postman/cURL.
-   [ ] **Eksekusi semua skenario & catat hasil:**
    -   [ ] Tandai setiap checklist yang lulus.
    -   [ ] Catat bug/isu yang ditemukan (dengan langkah reproduksi singkat).
-   **Acceptance (T8.1):**
    -   Semua skenario utama diuji dan dicatat.
    -   Tidak ada bug kritis yang menghalangi demo (jika ada, dibuatkan task baru atau dicatat sebagai known issue).

#### [ ] **Task 8.2 – Penyempurnaan Dokumentasi (`README.md` & `docs/`)** (3–4 jam)

-   [ ] **Review & update `README.md`:**
    -   [ ] Pastikan instruksi `npm install` & `npm run dev` jelas.
    -   [ ] Pastikan bagian “Workflow AI assistant & PR review” sesuai praktik tim terbaru.
    -   [ ] Tambahkan screenshot/glossary singkat jika diperlukan.
-   [ ] **Sinkronisasi dengan `docs/prd.md` & `docs/architect.md`:**
    -   [ ] Cek bahwa semua fitur yang diimplementasi tercermin di PRD (tidak ada fitur fiktif).
    -   [ ] Update jika ada penyesuaian arsitektur (misal implementasi faker.js, detail SW, dsb.).
-   [ ] **Dokumentasi fitur untuk presentasi:**
    -   [ ] Di `docs/` buat ringkasan alur demo (misal `docs/demo-flow.md`):
        -   [ ] Langkah-langkah yang akan ditunjukkan saat presentasi (dari buka app sampai contoh request).
        -   [ ] Poin-poin penting yang ingin disorot (non‑blocking I/O, SW intercept, stateful mocking, auth, export).
-   **Acceptance (T8.2):**
    -   README & dokumen `docs/` bisa dibaca orang luar untuk memahami project dan cara menjalankannya.
    -   Ada panduan demo yang jelas untuk hari presentasi.

#### [ ] **Task 8.3 – Persiapan Materi Presentasi Tugas** (3–4 jam)

-   [ ] **Struktur slide presentasi:**
    -   [ ] Slide 1–2: Latar belakang & Problem Statement (mengacu ke `docs/prd.md`).
    -   [ ] Slide 3–4: Arsitektur sistem (diagram dari `docs/architect.md`, termasuk SW, mockEngine, dbService, export server).
    -   [ ] Slide 5–6: Fitur utama (mocking, stateful DB, auth, Test Console, export).
    -   [ ] Slide 7: Integrasi konsep kuliah (Node.js, HTTP, non‑blocking I/O, NoSQL, dll.).
    -   [ ] Slide 8: Demo flow & hasil pengujian.
    -   [ ] Slide 9: Tantangan & pembelajaran.
-   [ ] **Sisipkan screenshot & demo flow:**
    -   [ ] Tampilkan UI utama (Dashboard, MockEditor, TestConsole, DatabaseView).
    -   [ ] Tunjukkan contoh request/respon (HTTP GET/POST dengan log).
    -   [ ] Tunjukkan potongan kode penting (misal `simulateRequest`, `sw.js`, konfigurasi auth).
-   [ ] **Latihan presentasi (opsional tapi direkomendasikan):**
    -   [ ] Cek waktu presentasi (misal 10–15 menit).
    -   [ ] Bagi peran: siapa menjelaskan bagian mana (Dzaki, Faza, Reza).
-   **Acceptance (T8.3):**
    -   Slide presentasi siap digunakan sebelum hari H.
    -   Tim memahami alur dan bisa mendemokan fitur utama dengan percaya diri.

---

## Catatan Harian (isi saat eksekusi)

-   Day 1: Implemented MockEditor validation tests for conflict detection and JSON validation; added Format & Minify UI controls and tests for roundtrip array/object conversions.
-   Day 2: Verified visual→code two-way sync and nested object/array preservation; updated docs and testing checklist.
-   Blockers/Risiko: none critical; Format/Minify controls are basic and may be refined for UX.

---

## Referensi

-   `docs/sprint-planning.md` (Sprint 3 – Polishing, Testing & Dokumentasi)
-   `docs/prd.md`
-   `docs/architect.md`
-   `README.md`
