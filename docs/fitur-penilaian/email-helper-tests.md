# Email helper — automated tests

I added an automated test file to validate upload input handling and the in-memory rate limiter.

-   Test file: `test/email-helper.upload.test.ts`
-   What it covers:
    -   disallowed file types return HTTP 400 with JSON error
    -   allowed uploads return a `url` and `expiresAt`
    -   rate limiting returns HTTP 429 when exceeded

Run tests locally:

```bash
npx tsx test/email-helper.upload.test.ts
```

Notes:

-   Tests load the helper freshly so environment variables (e.g., `EMAIL_HELPER_RATE_LIMIT`) can be adjusted per-test.
-   If you'd like I can add these tests to CI or expand them to mock external uploads (0x0.st) as an additional suite.
