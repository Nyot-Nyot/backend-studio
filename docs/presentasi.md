# Presentasi: Backend Studio — Ringkasan & Implementasi

## 1. Pendahuluan

Backend Studio adalah sebuah aplikasi single-page (React + Vite + TypeScript) yang dirancang untuk merancang, mensimulasikan, dan mengeksport API tanpa perlu server eksternal saat pengembangan. Tujuan utamanya adalah menyediakan lingkungan mock yang kaya: pengguna dapat membuat endpoint, mendefinisikan respons (termasuk respons dinamis dan stateful), menguji request via browser (Service Worker menangkap `/api/*`), mengekspor spesifikasi OpenAPI dan bundle server (Express), serta membagikan desain via email. Fitur tambahan termasuk streaming log real‑time (opsional) melalui Socket.IO dan utility scripts untuk pengujian/unggah file (mis. `email-helper` dan `socket-server`).

---

## 2. Cara penggunaan aplikasi (alur dari awal sampai akhir)

Penggunaan tipikal aplikasi ini mengikuti langkah-langkah berikut:

1. Setup & menjalankan lingkungan dev:

    - Instal dependensi: `npm install`.
    - Jalankan dev server: `npm run dev`.
    - Opsional: jalankan helper email untuk upload lampiran `npm run dev:helper` dan/atau socket server `npm run dev:socket`.

2. Buat atau buka workspace (project) di UI, lalu tambahkan mock endpoint melalui editor (path, method, status, response body, headers, delay, auth, proxy, storeName untuk stateful CRUD).

3. Uji endpoint: lakukan `fetch('/api/your-path')` pada tab yang sama. Service Worker akan mengintercept request dan meneruskannya ke aplikasi untuk diproses oleh Mock Engine; hasilnya dikembalikan ke halaman sebagai Response nyata.

4. Log dan observability: setiap request yang ditangani direkam ke log aplikasi. Jika socket server berjalan dan klien terhubung, log juga diterbitkan via `log:new` untuk UI lain.

5. Ekspor & bagikan:

    - Ekspor OpenAPI: pilih `Export → OpenAPI` untuk mendapatkan `openapi.json` (generator: `services/openApiService.ts`).
    - Ekspor server: gunakan fitur export untuk menghasilkan `server.js` (Express) yang dapat dijalankan dengan `node server.js` (generator: `services/exportService.ts`).
    - Kirim via Email: gunakan modal `EmailExportModal` yang memanfaatkan `services/emailService.ts` (EmailJS) dan `services/uploadService.ts` untuk lampiran.

6. Testing & CI: project menyertakan unit/integration/e2e tests (`npm run test:unit`, `npm run test:e2e`) yang memverifikasi OpenAPI export, mock engine, SW behavior, upload helper, socket stream, dan lain-lain.

---

## 3. Arsitektur project

Secara ringkas, arsitektur terdiri dari lapisan-lapisan berikut:

-   UI (React + Vite): editor mock endpoint, dashboard, modal ekspor/email, log viewer.
-   Service Worker (`sw.js`): intercept semua request yang dimulai dengan `/api/`, meneruskannya ke tab (message channel) agar aplikasi bisa menyimulasikannya (fallback ke cache / jaringan bila perlu).
-   Mock Engine (`services/mockEngine.ts`): "server" lokal yang mencocokkan route, menangani parameter jalur, query, badan request, autentikasi mock, proxy ke target eksternal (dengan validasi), dan stateful CRUD lewat `dbService`.
-   Storage & persistence: `services/dbService.ts` (IndexedDB / fallback) menyimpan proyek, mock, dan data stateful.
-   Exports: `services/openApiService.ts` (menghasilkan OpenAPI 3.0) dan `services/exportService.ts` (menghasilkan `server.js` Express minimal).
-   Email & Upload: `services/emailService.ts` (client EmailJS wrapper) dan `services/uploadService.ts` (unggah ke helper server local / 0x0.st), plus helper script `scripts/email-helper.cjs` yang menampung file sementara.
-   Real-time (opsional): `services/socketClient.ts` di UI dan `scripts/socket-server.cjs` untuk development log streaming (Socket.IO).
-   Testing & tooling: banyak skrip test dan feature docs (tes unit, e2e Playwright, helper test).

Arsitektur ini memungkinkan developer membangun dan menjajal API sepenuhnya di lingkungan lokal tanpa server nyata sampai mereka memilih untuk mengekspor artefak.

---

## 4. Penjelasan implementasi email (protokol dan alur)

Backend Studio menyediakan fitur pengiriman desain/artefak via email menggunakan pendekatan berlapis:

-   Client-side EmailJS (utama): UI `EmailExportModal` mengumpulkan `recipients`, `subject`, `message` dan pilihan lampiran (workspace JSON, `openapi.json`, `server.js`). Implementasi pengiriman berada di `services/emailService.ts` yang membungkus `@emailjs/browser`.

-   Lampiran & batas ukuran: `emailService` menerapkan batas per-file (1 MB) dan total (5 MB) untuk `sendEmailViaEmailJS`. File yang lebih besar atau banyak lampiran dapat di-zip terlebih dahulu dan diunggah ke helper server.

-   Upload helper (fallback untuk attachments): karena EmailJS attachment client-side direpotkan, alur yang direkomendasikan adalah membuat ZIP dari artefak dan mengunggahnya ke temporary upload server (`/upload-temp`), disediakan oleh `scripts/email-helper.cjs`. `services/uploadService.ts` mengurus retry, timeout, dan menengahi URL target berdasarkan environment.

-   Env & mode demo: environment vars seperti `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` mengkonfigurasi EmailJS; `VITE_EMAILJS_DEMO=true` aktifkan mode demo (simulasi, tidak benar-benar mengirim).

Contoh potongan penting (dari `services/emailService.ts`):

```ts
// Validasi lalu panggil EmailJS
const parameterTemplate = {
	to_email: penerima,
	subject: subjek,
	message: pesan,
	attachments: JSON.stringify(lampiran),
};
const respons = await emailjs.send(idLayanan, idTemplate, parameterTemplate, kunciPublik);
```

Jika menggunakan attachments publik cepat selama dev, `email-helper` bisa diatur `EMAIL_HELPER_UPLOAD_TO_0X0=true` sehingga file juga diunggah ke 0x0.st dan helper mengembalikan URL publik singkat.

---

## 5. Penjelasan implementasi API (mocking, SW, OpenAPI, exports)

-   Intercept & orchestration: `sw.js` memeriksa `fetch` events; jika path dimulai dengan `/api/` dan memenuhi kriteria (bukan static, bukan HMR, same-origin), SW membuat MessageChannel dan postMessage type `INTERCEPT_REQUEST` ke client. Client (App.tsx) mendengarkan pesan ini dan memanggil `simulateRequest` dari `services/mockEngine.ts` untuk menanggapi.

-   Mock Engine (`services/mockEngine.ts`): melakukan pencocokan rute (mendukung `:param`, `:param?`, `*` wildcard), menegakkan konfigurasi auth (Bearer/API key), mendukung proxy dengan validasi target (tidak mengizinkan target lokal/private), dan mengimplementasikan stateful behavior ketika `storeName` di-set (CRUD via `dbService`). Engine juga memproses template respons yang berisi token seperti `{{@param.id}}`, `{{@query.page}}`, `{{@body.name}}`, atau variabel sistem `{{$uuid}}`, `{{$isoDate}}`.

-   OpenAPI & eksport: `services/openApiService.ts` mengonversi mock aktif menjadi `openapi` 3.0 spec, menebak schema dari contoh response JSON; `services/exportService.ts` merender `server.js` Express minimal dengan rute inlined yang mengirim body literal (JSON/text) untuk tiap mock.

-   Contoh alur SW → App → Mock Engine (konteks):

```js
// sw.js (ringkasan)
self.addEventListener('fetch', event => {
  if (shouldIntercept(event.request)) {
    event.respondWith(/* kirim ke client dan tunggu port.postMessage response */);
  }
});

// App.tsx
navigator.serviceWorker.addEventListener('message', async ev => {
  if (ev.data.type === 'INTERCEPT_REQUEST') {
    const resp = await simulateRequest(...); // mockEngine
    port.postMessage({ response: resp });
  }
});
```

---

## 6. Penjelasan implementasi Socket programming

-   Server development: `scripts/socket-server.cjs` adalah server Socket.IO ringan untuk dev (default port 9150). Fungsionalitas utamanya:

    -   Mengizinkan koneksi CORS yang dikonfigurasi (env `SOCKET_ALLOWED_ORIGINS`).
    -   Middleware autentikasi handshake memakai token env `SOCKET_AUTH_TOKEN` (opsional).
    -   Batas laju per socket (`SOCKET_RATE_LIMIT`, `SOCKET_RATE_WINDOW_MS`) dan validasi payload.
    -   Endpoint HTTP kecil `/emit-log` untuk mengirim log (berguna saat socket tidak tersedia).
    -   Event handler penting: `join` / `leave` rooms, `log:publish` yang mem-broadcast `log:new` ke room yang relevan dan `logs:all`.

-   Client: `services/socketClient.ts` membungkus `socket.io-client` dan menyediakan API yang nyaman: `connect(token?)`, `on(event, handler)`, `emit(event, payload)`, `join(room)`, `disconnect()` dan manajemen handler tertunda sebelum koneksi.

-   Integrasi di App: saat App menangani request yang di-intercept dan menghasilkan log, App akan:
    -   Jika socket terkoneksi: `socket.emit('log:publish', payload)` (server akan broadcast ke room yang sesuai).
    -   Jika socket tidak terkoneksi: fallback HTTP `POST /emit-log` ke `socket-server`.

Contoh event handler ringkas (server):

```js
socket.on("log:publish", payload => {
	if (!rateLimited) {
		socket.broadcast.to(payloadRoom).emit("log:new", payload);
		socket.emit("log:ack", { ok: true });
	}
});
```

---

Catatan terakhir

-   Proyek ini memiliki dokumentasi di `/docs` (arsitektur, fitur email, log-stream, dsb.) dan suite tests yang bagus untuk memahami serta memverifikasi masing-masing bagian yang saya ringkas di atas.
-   Jika kamu mau, saya bisa memperluas `docs/presentasi.md` dengan diagram arsitektur sederhana, daftar environment variable penting, atau menambah petunjuk step-by-step untuk skenario tertentu (contoh: export+upload+email sekali klik). ✅
