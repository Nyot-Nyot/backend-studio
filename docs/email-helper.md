# Email helper (local upload sandbox)

This helper runs a tiny express server to accept temporary file uploads and optionally publish them to 0x0.st. It's intended for local development and not for production use.

## Quick usage

-   Run locally: `node scripts/email-helper.cjs` (or use `npm run dev:helper`).
-   Suppress console output (recommended in CI): add `--quiet` or set `EMAIL_HELPER_QUIET=true`.

## Configuration

-   `EMAIL_HELPER_PORT` (default: 3001)
-   `EMAIL_HELPER_TTL_HOURS` (default: 24)
-   `EMAIL_HELPER_UPLOAD_TO_0X0` (default: false)
-   `EMAIL_HELPER_PUBLIC_HOST` (alternative way to enable 0x0.st)
-   `EMAIL_HELPER_QUIET` or `--quiet` (silences informational logs and prevents printing potentially sensitive response bodies)
-   `EMAIL_HELPER_RATE_LIMIT` (default: 20) — uploads per window
-   `EMAIL_HELPER_RATE_WINDOW_HOURS` (default: 1) — window size in hours

## Security & operational notes

-   The server accepts only the following file extensions by default: `.zip`, `.json`, `.txt`, `.eml`, `.png`, `.jpg`, `.jpeg`, `.gif`.
-   Max upload size is 50MB and will return HTTP 413 when exceeded.
-   File names are sanitized before writing metadata to disk.
-   There's a simple in-memory rate limiter to limit uploads per IP; this protects against quick accidental floods but is not a replacement for production-grade rate limiting.
-   Do **not** use this server to host sensitive production data; it's intended for local dev/testing only.

## Recommended defaults for CI

-   Run the helper with `--quiet` to avoid leaking uploaded file URLs or other details into CI logs.
-   Consider disabling public uploads to `0x0.st` in CI by leaving `EMAIL_HELPER_UPLOAD_TO_0X0` unset or set to `false`.

---

If you'd like, I can add a small automated test for the upload validation and rate limiting next. ⚙️
