# Audit Alur Pengguna & Temuan UI/UX

Tanggal: 2025-12-28

Ringkasan singkat

-   Core flows yang saya temukan: MockEditor (buat/edit endpoint), Service Worker (intercept & handshake), Test Console (kirim request), DatabaseView (CRUD stateful), LogViewer (stream & inspect), Export/Import, Email export (EmailJS), dan fitur AI (OpenRouter) yang bersifat eksperimental.
-   Beberapa perbaikan sudah dilakukan (SW handshake timeout & fallback, masking token di MockEditor, openrouter client/proxy hardening). Namun masih ada banyak pekerjaan UI/UX P4 yang belum dikerjakan: design tokens, spacing scale, component refactor, micro-interactions, Storybook + visual regression tests, usability testing, dan aksesibilitas tingkat aplikasi.

Daftar alur inti

1. Startup & SW registration
    - File: `index.tsx`, `sw.js`
    - Behavior: mendaftarkan SW, SW meng-intercept `/api/*` dan mengirim pesan ke client untuk memproses.
2. Buat/Edit endpoint (MockEditor)
    - File: `components/MockEditor.tsx`, `components/mockEditorUtils.ts`
    - Behavior: konfig endpoint, auth config, generate sample response (AI optional), simulasikan request via Test Console.
3. Simulate request / Test Console
    - File: `TestConsole.tsx`, `LogViewer.tsx`
    - Behavior: kirim request, lihat logs, cek auth & responses.
4. DatabaseView CRUD
    - File: `DatabaseView.tsx`, `dbService.ts`
    - Behavior: view & modify collections; persistence across reloads.
5. Export / Import
    - File: `services/exportService.ts`, export tests
    - Behavior: generate `server.js`, currently minimal parity.
6. Email export & uploads
    - File: `services/emailService.ts`, `EmailExportModal.tsx`
7. Socket / Live logs
    - File: `scripts/socket-server.cjs`, `socketClient.ts`

Pain points & friction (prioritas awal)

-   Service Worker: masih ada risk pada message handshake (timeout handled but re-verify tests across browsers). Add Playwright e2e for unresponsive client scenario.
-   Masking & leak: beberapa preview/token masih ditampilkan (MockEditor uses `formatAuthPreview` — ensure masking everywhere and copy confirmation). Screenshots & Storybook should avoid showing secrets.
-   Design system: tidak ada design tokens, theming, atau spacing scale — causes visual inconsistency across components.
-   Component fragmentation: `MockEditor` dan `App.tsx` masih besar; extract `useSchemaEditor`, `useDragDrop`, `useSocket`, `useServiceWorker` hooks for testability.
-   Performance: long lists (`LogViewer`, `DatabaseView`) are not virtualized yet — large data sets will slow down UI.
-   Visual regression & Storybook: no Storybook or canonical component docs; no snapshot-based visual regression tests.
-   Accessibility: axe checks noted as TODO; focus order, modal traps, contrast need audit.
-   Acceptance criteria: missing per-UI-change acceptance checks and release gates (define per-task checklist).

Quick wins (high priority)

1. Create visual checklist & spacing scale (4/8/12/16/24/32) and apply to Buttons, Modals, Forms.
2. Implement theme tokens (colors, radii, shadow) and make theme switchable (light/dark).
3. Extract small hooks from `MockEditor` for unit tests and to make UI refactors low-risk.
4. Add Storybook skeleton and migrate major UI components (Button, Input, Modal, Toast) with examples for theme/spacing.
5. Add Playwright visual snapshot test pipeline (CI job) and a small Percy/Chromatic config (optional).
6. Run automated a11y passes (axe + Playwright) and fix high-impact issues (modal traps, labels, contrast).

Acceptance criteria (example)

-   Visual checklist: every component has tokenized colors/spacing; failing components are listed in PR description.
-   Theme: toggling theme updates all components; storybook previews both themes.
-   Spacing: all page layouts use spacing scale variables (no raw px values for margins/padding in components).
-   Accessibility: axe score above a tolerable threshold; keyboard navigation verified for modals and main pages.
-   Tests: Component unit tests + Playwright snapshots added and pass in CI.

Next steps saya

1. Buat checklist visual & UX (mulai sekarang).
2. Implement design tokens + theme (break into smaller PRs and add tests & Storybook entries).
3. Standarisasi spacing scale and apply to core components.

Catatan: Saya akan membuat PR terpisah untuk setiap langkah kecil (design tokens, components refactor, storybook, visual tests), memastikan ada unit + e2e tests, dan tidak mengubah fungsionalitas produksi tanpa test yang menutup perilaku yang sama.

---

Jika setuju, saya akan: (a) selesaikan `Buat checklist visual & UX` berikut detail checklist; (b) implement `design tokens` di `src/styles` atau `src/theme`; (c) buat PR bertahap dengan tests dan Storybook.
