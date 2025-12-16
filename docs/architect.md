## Backend Studio – Technical Architecture & Tech Stack Decisions

### 1. Tujuan Arsitektur

-   **Mendukung tujuan tugas kuliah Pemrograman Jaringan** dengan menampilkan penerapan:
    -   HTTP protocol & web server.
    -   Non‑blocking I/O dan asynchronous programming.
    -   API design & REST endpoint.
    -   Konsep NoSQL (MongoDB) dan penyimpanan state.
    -   Integrasi dengan layanan eksternal (AI) secara aman dan efisien.
-   **Menghindari biaya berlangganan**: seluruh fitur inti harus berjalan gratis; jika memakai layanan luar, sebisa mungkin hanya memanfaatkan **free tier** dan API key milik pengguna sendiri.
-   **Meminimalkan kompleksitas infrastruktur**: sebisa mungkin full client‑side (SPA) sehingga tidak perlu memelihara server backend khusus.

---

### 2. High‑Level Architecture

-   **Client‑Side SPA (Single Page Application)**:
    -   Seluruh UI, konfigurasi mock API, dan penyimpanan proyek berjalan di browser.
    -   Framework: **React + Vite** untuk dev experience cepat dan modul modern (ESM).
-   **Service Worker sebagai “virtual backend”**:
    -   File utama: `sw.js`.
    -   Mengintersep semua `fetch` request dari aplikasi (dan aplikasi lain di origin yang sama).
    -   Bertindak sebagai _reverse proxy_ lokal yang meneruskan request ke engine mocking di thread utama.
-   **Mock Engine di Frontend**:
    -   Implementasi di modul seperti `mockEngine.ts`, `dbService.ts`, dan komponen React.
    -   Mencocokkan request dengan konfigurasi endpoint, menjalankan logika delay, auth, CRUD, dan variable injection.
-   **Penyimpanan Data Lokal**:
    -   Menggunakan `localStorage` (dan bisa diperluas ke IndexedDB jika dibutuhkan).
    -   Menyimpan: proyek, daftar endpoint, environment variables, dan state database mock.
-   **Export Node.js Server (Optional)**:
    -   Aplikasi dapat menghasilkan file `server.js` + `package.json` berbasis **Express.js**.
    -   Server ini adalah artefak edukasi/praktikum: dijalankan secara lokal atau di platform gratis (Vercel/Render/Railway) bila diinginkan.

---

### 3. Pemilihan Tech Stack

#### 3.1 Runtime & Framework

-   **React 19 + Vite**
    -   Alasan:
        -   Ekosistem matang, banyak library UI dan tooling.
        -   Vite memberikan dev server cepat (HMR), cocok untuk eksperimen tugas kuliah.
        -   Component model React memudahkan pembuatan editor kompleks (Mock Editor, Log Viewer, dsb.).
    -   Kaitan dengan materi kuliah:
        -   Mempermudah demonstrasi konsumsi HTTP API dari sisi client (fetch, async/await).
        -   Struktur komponen membantu mengorganisasi UI untuk berbagai konsep jaringan (endpoint list, log, dsb.).

#### 3.2 Bahasa Pemrograman

-   **TypeScript (di atas JavaScript)**
    -   Alasan:
        -   Memberi _type safety_ untuk struktur data penting (MockEndpoint, Project, LogEntry).
        -   Mengurangi bug pada logika complex di mock engine dan service worker.
    -   Kaitan dengan materi:
        -   Tetap 100% kompatibel dengan konsep **JavaScript non‑blocking** (Promise, async/await, event loop).
        -   Memudahkan dokumentasi interface API (mirip kontrak API) yang sejalan dengan desain REST.

#### 3.3 Styling & UI

-   **Styling: Tailwind CSS / utility‑first CSS**
    -   Alasan:
        -   Produktif untuk membangun UI tool‑like (banyak panel, badge, status warna).
        -   Konsisten dengan requirement UI di PRD (Slate background, status color untuk HTTP method).
    -   Implementasi:
        -   Dapat menggunakan Tailwind CSS full, atau kombinasi CSS module + utilitas ringan jika setup perlu disederhanakan untuk tugas.
-   **Icons: Lucide React**
    -   Alasan:
        -   Ikon open‑source, ringan, bebas lisensi berbayar.
        -   Membantu membuat UI lebih jelas (status request, method HTTP, navigasi).

#### 3.4 Service Worker & Mock Engine

-   **Service Worker (`sw.js`)**
    -   Alasan:
        -   Mengimplementasikan konsep **web server** dan **request interception** langsung di browser.
        -   Mensimulasikan behaviour sisi server tanpa biaya hosting.
    -   Kaitan materi:
        -   Menunjukkan bagaimana HTTP request di-_handle_ sebelum sampai ke server.
        -   Menggunakan event‑driven dan asynchronous handling (non‑blocking).
-   **Mock Engine (`mockEngine.ts`, `dbService.ts`)**
    -   Alasan:
        -   Menjadi “jantung backend” yang sepenuhnya berjalan di client.
        -   Mengelola konfigurasi endpoint, auth, dan operasi CRUD terhadap data stateful.
    -   Kaitan materi:
        -   Menerapkan konsep **REST API**, **status code**, dan **header**.
        -   **Stateful mocking** bertindak sebagai analog NoSQL/MongoDB di lingkungan browser (koleksi dokumen).

#### 3.5 Data Layer (NoSQL Simulation)

-   **LocalStorage / IndexedDB sebagai NoSQL sederhana**
    -   Alasan:
        -   Tidak butuh server database terpisah → sepenuhnya gratis.
        -   Model key‑value/JSON cocok untuk mensimulasikan koleksi dokumen seperti di MongoDB.
    -   Kaitan materi:
        -   Mengilustrasikan konsep **collection**, **document**, dan operasi CRUD seperti di MongoDB.
        -   Fitur export Node.js dapat diperluas agar menggunakan **MongoDB Atlas (free tier)** bila dosen mengharuskan koneksi nyata ke database NoSQL.

#### 3.6 Node.js & Express (Export Server)

#### 3.6 Node.js & Express (Export Server)

#### 3.6 Node.js & Express (Export Server)

#### 3.6 Node.js & Express (Export Server)

-   **Node.js + Express.js (hasil export, bukan runtime utama)**
    -   Alasan:
        -   Menyambungkan tugas ini dengan materi **web server backend** secara eksplisit.
        -   Endpoint yang dirancang di UI bisa diterjemahkan ke route Express.
    -   Fitur:
        -   `server.js` hasil export berisi:
            -   Definisi route (method, path).
            -   Handler asinkron yang mengimplementasikan logika delay, auth check, dan response body.
        -   `package.json` hasil export menyertakan dependensi standar (express, cors, dsb.).
    -   Free tier deployment:
        -   Dapat di-_deploy_ ke platform gratis (Vercel/Render/Railway) bila ingin demo online.
        -   Misalnya: hanya gunakan `free instance` dan batasi jumlah request selama demo.

---

### 4. Keterkaitan dengan Materi Kuliah

-   **Node.js & JavaScript**:
    -   Editor dan mock engine ditulis dengan JavaScript/TypeScript.
    -   Export server berbasis Node.js memperlihatkan bagaimana konfigurasi API di UI diterjemahkan menjadi kode Node nyata.
-   **Non‑Blocking I/O & Asynchronous Programming**:
    -   Service Worker dan mock engine memakai `async/await` dan Promise untuk meng-_handle_ request secara non‑blocking.
    -   Export Express server juga menggunakan handler async (`async (req, res) => { ... }`).
-   **HTTP Protocol & API**:
    -   Mendukung full HTTP method (GET, POST, PUT, PATCH, DELETE, dll).
    -   Simulasi status code, header, query param, dan path param.
-   **Web Server & Express.js**:
    -   Walaupun runtime utama adalah browser, Node/Express tetap muncul sebagai artefak hasil export.
    -   Mahasiswa bisa menjalankan `node server.js` untuk melihat perilaku yang mirip server produksi.
-   **MongoDB & NoSQL**:
    -   Konsep koleksi dan dokumen di-_mapping_ ke penyimpanan JSON di LocalStorage/IndexedDB.
    -   Jika perlu, adaptor tambahan dapat dibuat untuk menulis ke MongoDB Atlas menggunakan connection string free tier.
-   **Protokol Email & Socket Programming (opsional / future work)**:
    -   Dapat ditambahkan modul contoh:
        -   Endpoint mock `POST /send-email` yang secara internal memanggil SMTP server dummy atau hanya mencatat log.
        -   WebSocket server sederhana di Node (mis. dengan `ws` atau `socket.io`) untuk broadcast log request ke beberapa client secara real‑time.
    -   Fitur ini bersifat tambahan untuk memperkaya presentasi tugas, tidak wajib untuk versi minimum.

---

### 5. Prinsip Biaya & Lisensi

-   **Zero Cost untuk Pengembang Aplikasi**:
    -   Tidak ada server backend yang harus selalu online.
    -   Tidak ada database berbayar yang digunakan secara permanen.
-   **Free Tier untuk Layanan Eksternal (Jika Digunakan)**:
    -   Layanan seperti MongoDB Atlas atau platform hosting Node (untuk demo) disarankan hanya menggunakan plan gratis.
-   **Open‑Source & Bebas Royalti**:
    -   React, Vite, Tailwind, Lucide, dan library pendukung lain dipilih yang berlisensi bebas untuk keperluan akademik dan proyek open‑source.

---

### 6. Kesimpulan

Arsitektur Backend Studio sengaja didesain **client‑side first** dengan Service Worker sebagai virtual backend untuk:

-   Memenuhi kebutuhan tugas Pemrograman Jaringan (HTTP, async, Node, API design, NoSQL).
-   Menghindari biaya infrastruktur dengan memaksimalkan browser dan free tier layanan eksternal.
-   Memberikan jalur jelas bagi pengembangan lanjutan (export Node/Express, integrasi MongoDB, email/socket module) tanpa perlu mengubah fondasi utama aplikasi.
