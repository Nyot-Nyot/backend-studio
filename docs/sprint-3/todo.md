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

#### [ ] **Task 7.1 – Validasi & Polishing `MockEditor`** (4–5 jam)

-   [ ] **Audit konfigurasi route & status:**
    -   [ ] Uji berbagai kombinasi `method` + `path` untuk memastikan conflict detection (`Route conflict: ... already exists`) muncul di kasus yang tepat.
    -   [ ] Pastikan user tidak bisa menyimpan route jika masih ada `conflictError` atau `jsonError`.
-   [ ] **Perbaikan validasi JSON:**
    -   [ ] Pastikan `validateJsonStructure` menolak root `null` dan tipe primitif (harus object/array).
    -   [ ] Cek bahwa error line (`getErrorLine`) menunjuk ke baris yang benar saat JSON invalid.
    -   [ ] Tombol “Format JSON” gagal dengan pesan jelas jika JSON invalid.
-   [ ] **Sinkronisasi mode `code` ↔ `visual`:**
    -   [ ] Dari mode code → visual:
        -   [ ] Jika JSON valid & bentuk array/object, visual editor terisi dengan field yang benar.
        -   [ ] Jika JSON tidak valid atau bentuknya tidak didukung → tampilkan error & tetap di mode code.
    -   [ ] Dari mode visual → code:
        -   [ ] Perubahan field langsung tercermin di `responseBody` (indentasi rapi).
    -   [ ] Uji nested object & array: pastikan konversi dua arah tidak menghilangkan field.
-   **Acceptance (T7.1):**
    -   Tidak ada crash saat mengedit JSON (baik di code mode maupun visual mode).
    -   Route dengan path duplikat tidak bisa disimpan; pesan error jelas.
    -   Pengguna bisa berpindah mode tanpa kehilangan data (selama JSON valid).

#### [ ] **Task 7.2 – Import/Export Workspace & Factory Reset** (3–4 jam)

-   [ ] **Verifikasi Export Configuration (`handleExportData`):**
    -   [ ] Pastikan `projects`, `mocks`, dan `envVars` tersimpan lengkap di file JSON.
    -   [ ] Buka file hasil export dan cek struktur (versi, timestamp, arrays).
-   [ ] **Verifikasi Import Configuration (`handleImportData`):**
    -   [ ] Uji import file yang valid: semua project, mocks, dan envVars ter-load.
    -   [ ] Uji import file rusak/format salah → tampilkan error message yang jelas, tidak merusak data lama.
    -   [ ] Uji scenario “Replace current workspace?” → pastikan data lama benar‑benar tergantikan hanya setelah user konfirmasi.
-   [ ] **Factory Reset:**
    -   [ ] Pastikan `localStorage.clear()` atau mekanisme yang digunakan menghapus semua key terkait app (`api_sim_*`, DB\_\*).
    -   [ ] Setelah reload, app kembali ke kondisi fresh install (hanya `Default Workspace`, tanpa mocks/data).
-   **Acceptance (T7.2):**
    -   Export/Import dapat digunakan oleh user non-teknis tanpa kehilangan data secara tak sengaja.
    -   Factory reset bekerja konsisten dan tidak meninggalkan sisa data lama.

#### [ ] **Task 7.3 – Cross‑browser & Layout Check** (3–4 jam)

-   [ ] **Uji di beberapa browser:**
    -   [ ] Chrome (desktop): semua fitur inti berjalan, tidak ada error di console.
    -   [ ] Firefox (desktop): SW bekerja, Test Console & DatabaseView normal.
    -   [ ] (Opsional) Edge/Brave: cek cepat tampilan & interaksi dasar.
-   [ ] **Uji di berbagai resolusi:**
    -   [ ] Laptop (1366×768): pastikan sidebar + main content terlihat baik, tidak ada elemen yang tertutup.
    -   [ ] Layar lebih lebar (≥ 1440px): layout tetap rapi, tidak ada elemen terlalu melebar.
    -   [ ] (Opsional) Tablet/layar kecil: cek minimal tampilan dasar.
-   [ ] **Perbaikan UX kecil:**
    -   [ ] Periksa konsistensi warna status (GET=biru, POST=hijau, DELETE=merah, dll.).
    -   [ ] Cek teks/label: tidak ada typo, bahasa konsisten (Indonesia/Inggris sesuai kebutuhan).
-   **Acceptance (T7.3):**
    -   Aplikasi responsif di beberapa ukuran layar; tidak ada layout rusak parah.
    -   Tidak ada error JavaScript yang muncul di console saat penggunaan normal.

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

-   Day 1: …
-   Day 2: …
-   Blockers/Risiko: …

---

## Referensi

-   `docs/sprint-planning.md` (Sprint 3 – Polishing, Testing & Dokumentasi)
-   `docs/prd.md`
-   `docs/architect.md`
-   `README.md`
