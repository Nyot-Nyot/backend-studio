# Daftar polish

-   [x] [App.tsx](./App.tsx)
-   [x] [index.tsx](./index.tsx)
-   [x] [sw.js](./sw.js)
-   [x] [types.ts](./types.ts)
-   [x] [src/theme/](./src/theme/)

-   [ ] [components/Button.tsx](./components/Button.tsx)
-   [ ] [components/Dashboard.tsx](./components/Dashboard.tsx)
-   [ ] [components/DatabaseView.tsx](./components/DatabaseView.tsx)
-   [ ] [components/EmailExportModal.tsx](./components/EmailExportModal.tsx)
-   [ ] [components/Input.tsx](./components/Input.tsx)
-   [ ] [components/LogViewer.tsx](./components/LogViewer.tsx)
-   [ ] [components/MockEditor.tsx](./components/MockEditor.tsx)
-   [ ] [components/MockEditor.tsx.bak](./components/MockEditor.tsx.bak)
-   [ ] [components/Modal.tsx](./components/Modal.tsx)
-   [ ] [components/Sidebar.tsx](./components/Sidebar.tsx)
-   [ ] [components/Sidebar.head.tsx](./components/Sidebar.head.tsx)
-   [ ] [components/TestConsole.tsx](./components/TestConsole.tsx)
-   [ ] [components/Textarea.tsx](./components/Textarea.tsx)
-   [ ] [components/Toast.tsx](./components/Toast.tsx)
-   [ ] [components/mockEditorUtils.ts](./components/mockEditorUtils.ts)

-   [ ] [contexts/](./contexts/)
-   [ ] [hooks/](./hooks/)
-   [ ] [types/](./types/)
-   [ ] [utils/](./utils/)

-   [ ] [services/aiService.ts](./services/aiService.ts)
-   [ ] [services/apiService.ts](./services/apiService.ts)
-   [ ] [services/authUtils.ts](./services/authUtils.ts)
-   [ ] [services/dbService.ts](./services/dbService.ts)
-   [ ] [services/indexedDbService.ts](./services/indexedDbService.ts)
-   [ ] [services/emailService.ts](./services/emailService.ts)
-   [ ] [services/exportService.ts](./services/exportService.ts)
-   [ ] [services/geminiService.ts](./services/geminiService.ts)
-   [ ] [services/mockEngine.ts](./services/mockEngine.ts)
-   [ ] [services/openApiService.ts](./services/openApiService.ts)
-   [ ] [services/openrouterClient.ts](./services/openrouterClient.ts)
-   [ ] [services/socketClient.ts](./services/socketClient.ts)
-   [ ] [services/uploadService.ts](./services/uploadService.ts)
-   [ ] [services/validation.ts](./services/validation.ts)
-   [ ] [services/zipService.ts](./services/zipService.ts)
-   [ ] [services/logger.ts](./services/logger.ts)
-   [ ] [services/idUtils.ts](./services/idUtils.ts)
-   [ ] [services/dataGenerator.ts](./services/dataGenerator.ts)
-   [ ] [services/scenarioService.ts](./services/scenarioService.ts)
-   [ ] [services/env.ts](./services/env.ts)
-   [ ] [services/aiErrors.ts](./services/aiErrors.ts)
-   [ ] [services/scenarioErrors.ts](./services/scenarioErrors.ts)
-   [ ] [services/uploadErrors.ts](./services/uploadErrors.ts)
-   [ ] [services/zipErrors.ts](./services/zipErrors.ts)
-   [ ] [services/retry.ts](./services/retry.ts)

-   [ ] [scripts/email-helper.js](./scripts/email-helper.js)
-   [ ] [email-helper.cjs](./email-helper.cjs)
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
