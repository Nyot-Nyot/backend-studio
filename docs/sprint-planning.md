## Backend Studio – Sprint Planning

### Konteks

- **Project**: Backend Studio (API Simulator)
- **Status saat ini**: Prototype frontend hampir selesai (layout SPA, dashboard, mock editor, settings, dsb. sudah ada).
- **Tujuan besar berikutnya**: Menyelesaikan logic inti (service worker + mock engine), stateful mocking, simulasi auth, export Node.js/Express + OpenAPI, dan dokumentasi akhir untuk tugas mata kuliah Pemrograman Jaringan.

---

## Sprint 1 – Core Engine & Service Worker

**Goal Sprint**
Alur `HTTP request → Service Worker → mockEngine → response` berfungsi penuh dan bisa dites dari UI (Test Console), sehingga dasar HTTP, REST, dan non‑blocking I/O sudah terimplementasi.

### Epic 1 – Service Worker Interceptor

#### Task 1.1 – Implementasi & perapian `sw.js`

- Tambah handler `install`, `activate`, dan terutama `fetch`.

**Di `fetch`:**

- Filter request yang akan di‑intercept (misalnya prefix `/api/` atau aturan lain sesuai desain).
- Buat `MessageChannel` untuk berkomunikasi dengan tab React.
- Kirim payload ke client: `{ method, url, headers, body }`.
- Terima balasan dari React (response hasil `simulateRequest`) dan bangun objek `Response` baru (`status`, `headers`, `body`, optional delay).

#### Task 1.2 – Registrasi Service Worker di React

- Di `index.tsx` atau `App.tsx`, daftarkan SW:
  - `navigator.serviceWorker.register('/sw.js')` dengan cek fitur.
  - Tambahkan logging sederhana (berhasil/gagal register) untuk debugging.
- Pastikan SW aktif sebelum trafik utama (bisa dengan reload sekali setelah install).

#### Task 1.3 – Uji manual alur intercept

- Buat 1–2 route mock sederhana (misalnya `GET /api/ping`, `POST /api/users`).
- Kirim request via:
  - `fetch` di DevTools console.
  - Test Console internal.
- Verifikasi:
  - Request benar‑benar lewat SW.
  - Response yang diterima berasal dari `simulateRequest`.

### Epic 2 – Integrasi `simulateRequest` + Logging

#### Task 2.1 – Verifikasi integrasi di `App.tsx`

- Listener `navigator.serviceWorker.addEventListener('message', ...)`:
  - Memanggil `simulateRequest(method, url, headers, body, mocksRef.current, envVarsRef.current)`.
  - Menerima `SimulationResult` dan menambah satu `LogEntry` baru ke state `logs`.
- Pastikan penggunaan `useRef` (`mocksRef`, `envVarsRef`) mencegah stale data ketika SW mengirim pesan.

#### Task 2.2 – Uji kasus utama `simulateRequest`

- Path & query:
  - `GET /api/users/123?active=true&page=2` dengan pattern `/api/users/:id`.
  - Cek variable injection: `{{@param.id}}` → `123`, `{{@query.page}}` → `2`.
- Dynamic generators:
  - `{{$uuid}}`, `{{$randomEmail}}`, `{{$isoDate}}`, dll. muncul di body.
  - Integrasikan **faker.js** (atau library sejenis) ke dalam generator dinamis agar data dummy lebih realistis dan acak.
- Header default:
  - `Content-Type: application/json`.
  - `X-Powered-By: BackendStudio`.

### Epic 3 – Test Console (HTTP Client Internal)

#### Task 3.1 – Lengkapi fungsi utama `TestConsole`

- Form untuk memilih HTTP method, path (bisa isi manual atau pilih dari daftar `mocks` aktif), dan Body JSON (untuk POST/PUT/PATCH).
- Saat submit:
  - Gunakan `fetch` ke URL yang diisi (agar tetap lewat SW).
  - Tampilkan hasil: status code, header, body, dan waktu eksekusi.

#### Task 3.2 – Integrasi dengan log & UX dasar

- Pastikan semua request dari Test Console otomatis tercatat di `logs` karena melewati SW.
- Tambahkan tombol “Run” dan “Re-run last request”.
- Tampilkan pesan error yang jelas jika `fetch` gagal (network error, JSON parse error, dll.).

**Definition of Done Sprint 1**

- SW aktif dan memotong request ke endpoint mock.
- `simulateRequest` terpakai end‑to‑end dari SW dan menghasilkan response yang sesuai PRD.
- Test Console bisa mengirim request dan menampilkan response dengan benar.
- Log request muncul di `LogViewer`.

---

## Sprint 2 – Stateful Mocking, Auth, & Export Backend

**Goal Sprint**
Fitur stateful mocking (CRUD di LocalStorage) berjalan, simulasi autentikasi berfungsi, dan export Node.js/Express + OpenAPI sesuai PRD dan arsitektur.

### Epic 4 – Stateful Mocking & Database View

#### Task 4.1 – Verifikasi & perkuat `dbService`

- Uji CRUD: `getCollection`, `insert`, `update`, `delete`.
- Auto‑ID: numeric auto‑increment atau UUID pendek sesuai kondisi existing data.
- Pastikan tipe ID (`string`/`number`) ditangani dengan loose compare (`==`) seperti yang sudah diimplementasi.

#### Task 4.2 – Uji alur stateful di `simulateRequest`

- Dengan `storeName` terisi:
  - `GET` tanpa param: kembalikan seluruh koleksi.
  - `GET` dengan param: kembalikan item by id, atau `404` jika tidak ada.
  - `POST`: parse body JSON, insert, dan kembalikan item baru.
  - `PUT/PATCH`: update item by id, `404` jika tidak ada, `400` jika JSON invalid.
  - `DELETE`: hapus item by id, `200` jika sukses, `404` jika tidak ada.

#### Task 4.3 – Implementasi `DatabaseView`

- Tampilkan daftar nama koleksi dari `dbService.listCollections()` dan isi koleksi dalam bentuk tabel/list JSON.
- Aksi: tombol delete per item, tombol “Clear collection” untuk menghapus semua data di koleksi, (opsional) tombol “Clear all DB” untuk semua koleksi.

### Epic 5 – Authentication Simulation

#### Task 5.1 – Pengujian logika auth di `simulateRequest`

- `BEARER_TOKEN`: Header yang dicek: `Authorization: Bearer <token>`. Jika salah / tidak ada → respon `401 Unauthorized`.
- `API_KEY`: Header yang dicek: `authConfig.headerKey` (default `x-api-key`). Jika salah / tidak ada → respon `401 Unauthorized`.

#### Task 5.2 – UX Auth di `MockEditor`

- Dropdown `Auth Type`: `NONE`, `BEARER_TOKEN`, `API_KEY`.
- Input: `headerKey` (untuk API key) dan `token` (nilai yang harus dicocokkan).
- Teks penjelas singkat: contoh header yang harus diisi di client/TestConsole.

#### Task 5.3 – Skenario uji

- Endpoint dengan:
  - Auth `NONE` → semua request lolos.
  - Auth Bearer:
    - Tanpa header → 401.
    - Header salah → 401.
    - Header benar → 200 / sesuai `statusCode`.
  - Auth API key:
    - Tanpa header yang diminta → 401.
    - Header salah → 401.
    - Header benar → 200 / sesuai `statusCode`.

### Epic 6 – Export Node.js Server & OpenAPI

#### Task 6.1 – Review & perkuat `generateServerCode` ✅ COMPLETE

- Pastikan mapping: Method → `app.get/post/put/delete/...`, Path → `mock.path`, Status → `mock.statusCode`, Body → `mock.responseBody` (pastikan JSON valid).
- Tambahkan middleware `express.json()`, `cors()` dan logging sederhana (`console.log(method, path, status)`) untuk contoh server Node.js.

#### Task 6.2 – Uji nyata hasil export ✅ COMPLETE

- Download `server.js` + `package.json`.
- Jalankan `npm install` lalu `node server.js`.
- Panggil route dari Postman/cURL dan cocokkan dengan definisi di UI.

#### Task 6.3 – Review `openApiService` ✅ COMPLETE

- Mapping `MockEndpoint` → OpenAPI: `paths[path][method]` dan `responses[statusCode].description` + `content['application/json']`.
- (Opsional) generate schema kasar dari `responseBody` jika memungkinkan, atau minimal gunakan contoh (`example`).

#### Task 6.4 – Uji `openapi.json` ✅ COMPLETE

- Export menggunakan tombol di Settings dan buka di Swagger Editor (`editor.swagger.io`) untuk cek validitas dan tampilan.
- **Results:** 14/14 validation tests passing. Generated openapi.json fully Swagger Editor compatible, all endpoints display correctly with proper formatting.
- **Key Validations:**
  - Path parameters correctly converted (`:id` → `{id}`)
  - HTTP methods lowercase
  - Request/response bodies with examples
  - Nested paths properly formatted
  - Inactive endpoints excluded
  - Tags and descriptions present for UI organization

**Definition of Done Sprint 2**

- CRUD stateful berjalan dari endpoint mock → LocalStorage → DatabaseView.
- Simulasi authentication berfungsi dan bisa didemokan dari Test Console.
- Export `server.js` (Express) dan `openapi.json` bisa dijalankan/divalidasi tanpa error.

---

## Sprint 3 – Polishing, Testing & Dokumentasi

**Goal Sprint**
UX halus, aplikasi stabil, dan dokumentasi + skenario uji siap untuk presentasi tugas Pemrograman Jaringan.

### Epic 7 – Polishing UX & Robustness

#### Task 7.1 – Validasi & polishing MockEditor

- Periksa deteksi konflik route (method + path) bekerja dan memblokir save dengan pesan yang jelas.
- Validasi JSON di mode code (`validateJsonStructure`) harus konsisten dengan mode visual: jangan mengizinkan root `null` atau tipe primitif untuk visual mode.
- Pastikan perpindahan mode visual ↔ JSON tidak menyebabkan kehilangan struktur atau error diam‑diam.

#### Task 7.2 – Import/Export Workspace & Factory Reset

- Uji export config (projects, mocks, envVars) dan import kembali file yang sama agar semua data kembali seperti sebelumnya.
- Pastikan `Factory Reset` menghapus data aplikasi di LocalStorage dan setelah reload app kembali ke state awal (DEFAULT_PROJECT, dsb.).

#### Task 7.3 – Cross‑browser & layout check

- Cek minimal di Chrome dan Firefox (dan satu lagi jika sempat) dan uji di resolusi berbeda untuk memastikan layout tidak pecah.

### Epic 8 – Testing Terstruktur & Dokumentasi Akhir

#### Task 8.1 – Daftar skenario uji dari PRD

- Buat checklist (bisa di docs terpisah) yang mencakup Workspace & Project Management, Route design & mocking (static + dynamic path + generators), Stateful mocking & DatabaseView, Authentication simulation, Testing & monitoring (Test Console + Log Viewer), dan Export & deployment (OpenAPI, Node.js server).
- Jalankan satu per satu dan simpan catatan/screenshot bila perlu.

#### Task 8.2 – Dokumentasi di `README.md` / `docs`

- Tambah cara menjalankan project: `npm install`, `npm run dev`.
- Flow demo singkat:
  1. Buat route baru (MockEditor).
  2. Tes via Test Console.
  3. Lihat log di LogViewer.
  4. Lihat state di DatabaseView (untuk route stateful).
  5. Export OpenAPI dan Node.js server.
- Sertakan link ke `docs/prd.md` dan `docs/architect.md` sebagai dokumen desain.

#### Task 8.3 – Persiapan materi presentasi tugas

- Rangkuman singkat bagaimana project ini mengimplementasikan materi: Node.js, Express, HTTP, non‑blocking I/O, NoSQL (MongoDB), dsb.
- Diagram arsitektur ringkas (client‑side SPA + Service Worker + export Node server).
- Pastikan semua poin penting sudah tercermin di slide/laporan.

**Definition of Done Sprint 3**

- UX editor, import/export, dan reset stabil.
- Ada dokumentasi yang cukup untuk menjalankan, menguji, dan mempresentasikan aplikasi sebagai tugas Pemrograman Jaringan.
