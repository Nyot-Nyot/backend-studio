# Email Export (Client-side EmailJS) 📧

This documents the Email Export feature (client-side EmailJS MVP).

## What it does

-   Allows users to send their current workspace and selected generated files (OpenAPI, server.js) via email directly from the browser using EmailJS.

## How to enable

-   Set `VITE_ENABLE_EMAIL=true` to enable the UI by default, or enable temporarily by setting `feature_email_export` in localStorage to `true`.
-   Required env vars (client-side/public keys):

    -   `VITE_EMAILJS_SERVICE_ID`
    -   `VITE_EMAILJS_TEMPLATE_ID`
    -   `VITE_EMAILJS_PUBLIC_KEY`

-   Demo/testing: set `VITE_EMAILJS_DEMO=true` to simulate sends locally without configuring EmailJS (safe for development).

-   For attachments: EmailJS client attachment support is unreliable. Backend helper approach is used: selected files are bundled into a ZIP, uploaded to a temporary server (`/upload-temp`), and a short-lived download link is included in the email body. For quick public sharing during development we support uploading to 0x0.st — enable by setting `EMAIL_HELPER_UPLOAD_TO_0X0=true` in `.env` (this uploads files to 0x0.st and returns a public URL).

> Note: Public keys are exposed to clients. For production, prefer a server-side relay to keep secrets private.

## Usage

1. Open `Export & Deploy Hub` → click `Send via Email`.
2. Enter recipient emails (comma, semicolon, or new line separated).
3. Choose attachments (Workspace JSON, OpenAPI, server.js).
4. Preview attachment size and click `Send Email`.

## Limits & Security

-   Attachment size limit: 20 MB (client-enforced). Email providers may have lower limits.
-   Warn users about sending PII or sensitive data. The UI includes an explicit warning before sending.
-   For production, migrate to server relay for rate-limits, spam protection, and secret management (SendGrid, SES).

## Developer notes

-   Frontend entry point: `components/EmailExportModal.tsx`.
-   Client EmailJS wrapper: `services/emailService.ts` (uses `@emailjs/browser`).
-   ZIP helper: `services/zipService.ts` (uses `jszip`).
-   Add e2e tests: `test/*` and Playwright specs under `test/e2e` should include happy and error paths.

---

If you'd like, I can add a page to the in-app Help area linking to this document and add more detailed template guidance for EmailJS templates.
