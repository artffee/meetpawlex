# Waitlist verification — 2026-10-28

## Automated backend tests: 34 passed

`npm test` covers save-before-success, normalized email duplicates, concurrent
submissions, non-overwriting duplicates, missing stored records, storage failure,
rate limits shared across handlers, strict input limits/types/enums, required
consent, honeypot, expiring/tampered/IP-bound challenges, same-origin checks,
missing secrets, content type/body size, HTTP methods, and notification failures,
redaction and deduplication. Storage is an in-memory test double in these tests;
real-provider checks are listed separately below.

## Browser behavior: passed at 320, 390, 768 and 1440 pixels

Chromium exercised required fields, consent, a simulated HTTP 503, retained input,
a successful retry, cleared fields only after acceptance, no applicant data in
console messages, and no horizontal overflow. Local tests use the actual HTTP
handler with in-memory storage. A 390-pixel screenshot was visually inspected.
The installed runtime's browser downloader failed; tests used a packaged
Chromium 138 executable instead, through `CHROMIUM_EXECUTABLE_PATH`.

## Real Vercel preview and private Blob storage: passed

Deployment: `dpl_Cqi9pea3gxjivPz2ekqtYe7qXPys`.

- Successful synthetic application: HTTP 200 with `accepted: true`.
- Same email with changed case/whitespace: same HTTP 200 acceptance, one original
  application retained. Provider reported 3 private objects: one application and
  two request-rate markers, not two applications.
- Missing consent, honeypot, invalid email, tampered token: HTTP 400; no acceptance.
- Untrusted origin: HTTP 403.
- Maintenance without authorization: HTTP 401.
- Maintenance with configured cron credential: HTTP 200.
- Runtime error/warning log query after these tests: no matches.

All submitted data is synthetic (`example.com`), clearly labeled as release QA.
No real person was emailed. Notifications are disabled pending provider setup;
actual email delivery is not claimed or tested.

The baseline scanner function and unrelated public pages remain referenced by
unchanged deployment content hashes. Their product behavior is outside this
waitlist test scope.

Real preview mobile submission passed at 390 pixels with no JavaScript errors. Two
concurrent duplicate requests both returned 200, followed by a 429 after five
valid attempts. Four storage-adapter tests verify environment isolation, conflict
confirmation, provider failure behavior and scoped listings. Preview browser
traffic used the workspace proxy with a browser-only trust override; no site
TLS setting was changed.
