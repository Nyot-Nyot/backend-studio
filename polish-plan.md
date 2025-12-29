# Daftar polish

-   [x] [App.tsx](./App.tsx)
-   [x] [index.tsx](./index.tsx)
-   [x] [sw.js](./sw.js)
-   [x] [types.ts](./types.ts)
-   [x] [src/theme/](./src/theme/)

-   [x] [components/Button.tsx](./components/Button.tsx)
-   [x] [components/Dashboard.tsx](./components/Dashboard.tsx)
-   [x] [components/DatabaseView.tsx](./components/DatabaseView.tsx)
-   [x] [components/EmailExportModal.tsx](./components/EmailExportModal.tsx)
-   [x] [components/Input.tsx](./components/Input.tsx)
-   [x] [components/LogViewer.tsx](./components/LogViewer.tsx)
-   [x] [components/MockEditor.tsx](./components/MockEditor.tsx)
-   [x] [components/Modal.tsx](./components/Modal.tsx)
-   [x] [components/Sidebar.tsx](./components/Sidebar.tsx)
-   [x] [components/Sidebar.head.tsx](./components/Sidebar.head.tsx)
-   [x] [components/TestConsole.tsx](./components/TestConsole.tsx)
-   [x] [components/Textarea.tsx](./components/Textarea.tsx)
-   [x] [components/Toast.tsx](./components/Toast.tsx)
-   [x] [components/mockEditorUtils.ts](./components/mockEditorUtils.ts)

-   [x] [utils/](./utils/)

-   [x] [services/aiService.ts](./services/aiService.ts)
-   [x] [services/apiService.ts](./services/apiService.ts)
-   [x] [services/authUtils.ts](./services/authUtils.ts)
-   [x] [services/dbService.ts](./services/dbService.ts)
-   [x] [services/indexedDbService.ts](./services/indexedDbService.ts)
-   [x] [services/emailService.ts](./services/emailService.ts)
-   [x] [services/exportService.ts](./services/exportService.ts)
-   [x] [services/mockEngine.ts](./services/mockEngine.ts)
-   [x] [services/openApiService.ts](./services/openApiService.ts)
-   [x] [services/openrouterClient.ts](./services/openrouterClient.ts)
-   [x] [services/socketClient.ts](./services/socketClient.ts)
-   [x] [services/uploadService.ts](./services/uploadService.ts)
-   [x] [services/validation.ts](./services/validation.ts)
-   [x] [services/zipService.ts](./services/zipService.ts)
-   [x] [services/logger.ts](./services/logger.ts)
-   [x] [services/idUtils.ts](./services/idUtils.ts)
-   [x] [services/dataGenerator.ts](./services/dataGenerator.ts)
-   [x] [services/scenarioService.ts](./services/scenarioService.ts)
-   [x] [services/env.ts](./services/env.ts)
-   [x] [services/aiErrors.ts](./services/aiErrors.ts)
-   [x] [services/scenarioErrors.ts](./services/scenarioErrors.ts)
-   [x] [services/uploadErrors.ts](./services/uploadErrors.ts)
-   [x] [services/zipErrors.ts](./services/zipErrors.ts)
-   [x] [services/retry.ts](./services/retry.ts)

-   [x] [scripts/email-helper.js](./scripts/email-helper.js)
-   [x] [email-helper.cjs](./email-helper.cjs)
-   [ ] [openrouter-proxy.cjs](./openrouter-proxy.cjs)
-   [ ] [socket-server.cjs](./socket-server.cjs)

# code conventions

-   **Bahasa** : Seluruh kode dan komentar wajib menggunakan **Bahasa Indonesia**. Istilah teknis yang umum dan mapan (mis. `HTTP`, `API`, `HTML`, `CSS`, `JavaScript`, `TypeScript`, `React`, `Node`, `JSON`, `SQL`, `URL`, `JWT`) boleh tetap menggunakan istilah aslinya (Bahasa Inggris).

-   **Penamaan** : Gunakan nama variabel, fungsi, kelas, dan file yang **deskriptif** dan mudah dimengerti dalam Bahasa Indonesia. Hindari singkatan yang tidak jelas; nama yang panjang dan jelas lebih baik daripada singkat tapi ambigu.

-   **Keterbacaan / Verbose** : Tuliskan kode yang **sangat verbous dan readable** — tujuan agar pembaca bisa langsung mengerti apa yang dilakukan kode dalam sekali lihat.

    -   Pecah logika menjadi fungsi-fungsi kecil dengan nama yang menjelaskan tujuannya.
    -   Gunakan komentar singkat dalam Bahasa Indonesia untuk menjelaskan **mengapa** sesuatu dilakukan, bukan hanya **bagaimana**.
    -   Bila perlu, sertakan contoh singkat penggunaan pada komentar untuk fungsi publik.

-   **Clean Code & Maintainable** :

    -   Terapkan prinsip _Single Responsibility_, _DRY_, dan _KISS_.
    -   Gunakan tipe yang eksplisit (TypeScript) dan hindari `any` jika memungkinkan.
    -   Hindari solusi “pintar” yang mengorbankan keterbacaan; utamakan kejelasan dan keterpeliharaan.
    -   Struktur folder dan file harus mencerminkan tanggung jawab modul.

-   **Komentar** : Komentar untuk menjelaskan intent, asumsi, batasan, dan kontrak fungsi. Jangan menulis komentar yang hanya mengulangi kode.
