# Product Requirements Document (PRD)

**Project Name:** Backend Studio (API Simulator)
**Version:** 1.0.0
**Status:** Beta / Active Development
**Platform:** Web Application (Client-Side SPA, No Dedicated Backend)

---

## 1. Executive Summary

**Backend Studio** adalah platform berbasis web yang memungkinkan pengembang (Frontend, Backend, dan QA) untuk merancang, mem-prototipe, dan mensimulasikan REST API backend tanpa perlu menulis kode server yang sebenarnya. Aplikasi ini berjalan sepenuhnya di browser menggunakan teknologi **Service Worker** untuk mengintersep _network request_, memungkinkan simulasi latensi, validasi autentikasi, dan operasi CRUD database (stateful) secara real-time.

Tujuan utama produk ini adalah mempercepat siklus pengembangan frontend dengan menyediakan kontrak API yang fungsional sebelum backend sesungguhnya siap.

---

## 2. Problem Statement

Dalam pengembangan perangkat lunak modern:

1.  **Frontend Blocked:** Tim Frontend sering harus menunggu tim Backend selesai membuat API.
2.  **Static Mocks:** Hardcoded JSON di kode frontend sulit dikelola dan tidak mensimulasikan kondisi jaringan nyata (delay/error).
3.  **Kompleksitas Setup:** Menyiapkan server mock lokal (Node/Express) membutuhkan waktu konfigurasi.
4.  **Kurangnya Data Realistis:** Sulit membuat data dummy yang bervariasi dan dinamis untuk keperluan testing.

---

## 3. User Personas

-   **Frontend Developer:** Ingin segera mengintegrasikan UI dengan API meskipun backend belum siap.
-   **QA Engineer:** Ingin menguji _edge cases_ (error 500, timeout, unauthorized) tanpa merusak server staging.
-   **Product Designer:** Ingin mendemonstrasikan prototipe aplikasi yang terasa "hidup" dengan data dinamis.
-   **API Architect:** Ingin mendesain struktur response JSON secara visual dan mengekspornya ke dokumentasi standar (OpenAPI).

---

## 4. Functional Requirements

### 4.1. Workspace & Project Management

-   **Multi-Project Support:** Pengguna dapat membuat dan berpindah antar "Workspace" (Project).
-   **Global Environment Variables:** Pengguna dapat mendefinisikan variabel global (misal: `base_url`, `api_token`) yang dapat disuntikkan ke dalam response body menggunakan sintaks `{{variable_name}}`.
-   **Persistence:** Semua data (proyek, route, env vars) disimpan secara lokal menggunakan `localStorage` browser.
-   **Import/Export:** Kemampuan untuk mem-backup seluruh workspace ke file JSON dan me-restore-nya.

### 4.2. Route Design & Mocking

-   **CRUD Method Support:** Mendukung HTTP Method: GET, POST, PUT, DELETE, PATCH.
-   **Dynamic Paths:** Mendukung parameter URL dinamis (contoh: `/api/users/:id`).
-   **Response Configuration:**
    -   Menentukan HTTP Status Code (200, 201, 400, 404, 500, dll).
    -   **Latency Simulation:** Mengatur delay buatan (ms) untuk mensimulasikan jaringan lambat.
    -   **Custom Headers:** Menambahkan header respons kustom.
-   **Active/Inactive Toggle:** Mematikan/menghidupkan endpoint tertentu tanpa menghapusnya.

### 4.3. Response Body Editor (Mock Editor)

-   **Dual Mode Editor:**
    -   **Visual Editor:** Interface _Tree-View_ dengan kemampuan _Drag-and-Drop_ untuk menyusun struktur JSON tanpa mengetik sintaks. Mendukung tipe data (String, Number, Boolean, Object, Array, Null).
    -   **Code Editor:** Editor teks Raw JSON dengan _line numbering_, _syntax highlighting_, dan validasi format.
-   **Dynamic Generators:** Menyediakan variabel dinamis bawaan (Faker-like):
    -   `{{$uuid}}`
    -   `{{$randomName}}`
    -   `{{$randomEmail}}`
    -   `{{$isoDate}}`
    -   `{{$randomInt}}`
    -   `{{@param.key}}` (Mengambil nilai dari URL parameter)
    -   `{{@query.key}}` (Mengambil nilai dari Query string)

> **Catatan eksperimen:** Terdapat fitur _optional_ yang menggunakan model AI (misal: OpenRouter deepseek) untuk _auto-generate_ response atau endpoint configs. Fitur ini bersifat **eksperimental** dan membutuhkan API key atau proxy server yang dikonfigurasi oleh pengguna. Hasil generator AI dapat bervariasi; pastikan untuk meninjau dan memverifikasi output sebelum digunakan di workspace atau saat mengekspor.

-   **Feature flags:** Experimental features are configurable via localStorage (`feature_ai`, `feature_sw`, `feature_logviewer`, `feature_proxy`, `feature_export`) or environment variables (`VITE_ENABLE_*`). The Traffic Monitor (live logs) and Service Worker interception are enabled by default; other experimental features (AI provider, Proxy, Export Server) remain behind feature flags and are disabled unless explicitly enabled.

> **Schema & Data Generator (baru):** Ditambahkan layanan awal untuk mendefinisikan `ResourceSchema` dan menghasilkan data contoh (file: `services/dataGenerator.ts`, tipe: `ResourceSchema` di `types.ts`). Saat ini generator menyediakan opsi dasar (uuid, randomName, email, isoDate, number, boolean) dan dapat digunakan untuk seed collection di UI DatabaseView (seed workflow akan diimplementasikan lebih lanjut).

### 4.4. Stateful Mocking (In-Memory Database)

-   **Logic:** Mensimulasikan backend nyata yang bisa menyimpan data (bukan hanya respon statis).
-   **Store Name Binding:** Menghubungkan endpoint dengan nama koleksi (misal: `users`).
-   **Auto-CRUD Logic:**
    -   **POST:** Menyimpan data baru ke koleksi.
    -   **GET (List):** Mengambil semua data.
    -   **GET (Detail):** Mengambil data berdasarkan ID.
    -   **PUT/PATCH:** Memperbarui data berdasarkan ID.
    -   **DELETE:** Menghapus data berdasarkan ID.
-   **(Removed)** _Database Viewer_ — UI page removed; stateful mocking (in-memory persistence) remains available via APIs and engine (no dedicated visual page).

### 4.5. Authentication Simulation

-   **Auth Types:**
    -   **None:** Publik.
    -   **Bearer Token:** Memvalidasi header `Authorization: Bearer <token>`.
    -   **API Key:** Memvalidasi header custom (misal: `x-api-key`).
-   **Validation:** Jika token tidak cocok, sistem otomatis mengembalikan status `401 Unauthorized`.

### 4.6. Testing & Monitoring

-   **Prototype Lab (Test Console):** HTTP Client bawaan (seperti Postman/Insomnia) untuk menguji endpoint langsung di dalam aplikasi.
-   **Traffic Monitor (Log Viewer):**
    -   Mencatat semua request yang masuk secara real-time.
    -   Menampilkan Timestamp, Method, Path, Status Code, Latency, dan IP Klien (simulasi).
    -   Fitur Filter dan Pause logs.

### 4.7. Export & Deployment

-   **OpenAPI Export:** Menghasilkan file `openapi.json` (Swagger) berdasarkan definisi route yang ada.
-   **Node.js Server Export (Optional):** Menghasilkan file `server.js` dan `package.json` mandiri (Express.js). **Catatan penting:** artefak export ini bersifat **minimal dan statis**—pada versi ini server yang dihasilkan _menginline_ response yang dikonfigurasi sebagai handler statis. **Terlampir:** export tidak secara otomatis menerapkan pengecekan autentikasi per-route, simulasi delay (Service Worker), logika DB stateful/CRUD, atau proxy passthrough. Jika Anda membutuhkan server yang meniru perilaku penuh aplikasi (auth, delay, DB), ekspor harus diperluas secara manual atau menunggu fitur parity yang tercantum di roadmap.
-   **Node.js Server Export (Educational):** Fitur ini tetap berguna sebagai artefak edukasi yang memperlihatkan bagaimana route dapat diterjemahkan ke Express, namun jangan mengandalkannya sebagai pengganti backend produksi.

---

## 5. Non-Functional Requirements

### 5.1. Performance

-   **Zero-Latency UI:** Transisi antar halaman harus instan (< 100ms).
-   **Interception Speed:** Overhead Service Worker dalam mengintersep request harus minimal (< 10ms tambahan di luar delay buatan).

### 5.2. Security

-   **Data Privacy:** Semua data (Project, API Mock, Database) tersimpan **hanya di browser pengguna** (Local Storage / IndexedDB). Tidak ada data yang dikirim ke server cloud milik pengembang aplikasi.
-   **Free Tier Friendly:** Aplikasi inti dapat digunakan sepenuhnya tanpa akun pihak ketiga. Jika suatu saat ada integrasi layanan eksternal, layanan tersebut harus mengandalkan **free tier** milik pengguna masing‑masing dan bersifat opsional.

### 5.3. Compatibility

-   **Browser Support:** Modern Browsers (Chrome, Edge, Firefox, Safari) yang mendukung Service Worker API.

---

## 6. UX/UI Requirements

### 6.1. Design Language

-   **Theme:** Clean, Modern, Professional Developer Tool.
-   **Color Palette:** Slate (Backgrounds), Brand Blue/Cyan (Primary Actions), Emerald/Red/Amber (Status Indicators).
-   **Typography:** `Inter` untuk UI umum, `JetBrains Mono` untuk kode dan data.

### 6.2. Key Interactions

-   **Drag and Drop:** Pengalaman pengeditan JSON visual harus mulus dengan indikator visual yang jelas saat memindahkan field.
-   **Visual Feedback:** Toast notifications untuk setiap aksi (Save, Delete, Copy, Error).
-   **Status Indikator:** Warna yang jelas untuk membedakan HTTP Method (GET=Biru, POST=Hijau, DELETE=Merah).

---

## 7. Technical Architecture

### 7.1. Tech Stack (Target)

-   **Runtime Utama:** Browser (Client-Side SPA) untuk seluruh fitur simulasi API.
-   **Framework Frontend:** React 19 dengan bundler Vite (SPA).
-   **Styling:** Utility‑first CSS (Tailwind CSS atau CSS utility custom) — implementasi dapat disesuaikan dengan kebutuhan dan batasan tugas.
-   **Icons:** Lucide React.
-   **Bahasa:** TypeScript / JavaScript.

> Catatan: Seluruh fitur inti (mocking, service worker, stateful database) berjalan **tanpa** backend Node.js permanen. Node/Express hanya digunakan sebagai **artefak hasil export** untuk mendemonstrasikan pemahaman materi kuliah.

### 7.2. Core Mechanism (Service Worker Interceptor)

Inti dari aplikasi ini adalah `sw.js`.

1.  Aplikasi mendaftarkan Service Worker saat startup.
2.  Setiap kali aplikasi (atau aplikasi lain di domain yang sama) melakukan `fetch()`, Service Worker mengintersep request tersebut. Jika **tidak ada** client (mis. tidak ada tab browser yang aktif atau tersedia untuk memproses pesan), Service Worker akan melakukan _fallback_ ke jaringan (network) dan tidak mengintersep request tersebut.
3.  Request dikirim via `MessageChannel` ke thread utama React (`App.tsx` -> `mockEngine.ts`).
4.  `mockEngine.ts` mencocokkan URL dengan daftar `mocks` yang ada.
5.  Engine memproses logika (Delay, Auth, CRUD Database, Variable Injection) secara **asynchronous** dan **non‑blocking**, menerapkan konsep event loop dan Promise di lingkungan browser.
6.  Respons dikirim kembali ke Service Worker, yang kemudian memberikannya ke browser seolah-olah berasal dari server asli.

### 7.3. Data Structure (Types)

-   `MockEndpoint`: Menyimpan konfigurasi route tunggal.
-   `Project`: Wadah untuk mengelompokkan endpoint.
-   `LogEntry`: Rekaman histori request.
-   `dbService`: Abstraksi CRUD sederhana di atas LocalStorage untuk fitur Stateful Mocking (berperan sebagai pengganti NoSQL database seperti MongoDB untuk konteks tugas yang full‑client).

### 7.4. Kesesuaian dengan Materi Mata Kuliah

-   **Node.js & Express.js:** Direpresentasikan melalui fitur **Node.js Server Export** yang menghasilkan kode server mock Express non‑blocking berbasis JavaScript.
-   **Non‑Blocking I/O & Asynchronous Programming:** Diimplementasikan melalui pemakaian `fetch`, Promise, dan event loop pada Service Worker & React, serta (dalam artefak export) pada handler Express.
-   **HTTP Protocol & Web Server:** Seluruh desain endpoint mengikuti pola REST HTTP (method, status code, headers, body).
-   **API Architecture Pattern:** Mendukung perancangan resource‑oriented API dengan path dinamis dan simulasi autentikasi.
-   **NoSQL / MongoDB:** Disimulasikan dengan koleksi berbasis key‑value di LocalStorage/IndexedDB; pada export Node nantinya dapat diperluas untuk menggunakan MongoDB Atlas (free tier) bila diperlukan.
-   **Socket Programming:** Tidak menjadi bagian fitur inti, namun dapat dipertimbangkan sebagai **ekstensi** (misal: WebSocket untuk live log update) tanpa menambah dependensi berbayar.

---

## 8. Roadmap (Future Considerations)

-   **GraphQL Support:** Menambahkan dukungan untuk mocking GraphQL query/mutation.
-   **Team Collaboration:** Fitur sinkronisasi real-time antar pengguna menggunakan WebRTC atau backend ringan (misal: Firebase).
-   **Response Fuzzing:** Opsi untuk secara acak mengembalikan error (Chaos Engineering) untuk menguji ketahanan frontend.
-   **Middleware Chaining:** Kemampuan untuk menambahkan logika JS kustom di tengah pipeline request.
