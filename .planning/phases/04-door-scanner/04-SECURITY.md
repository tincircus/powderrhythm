---
phase: 04-door-scanner
audited_at: 2026-05-20
asvs_level: 1
auditor: gsd-security-auditor
threats_total: 11
threats_closed: 11
threats_open: 0
result: SECURED
---

# Phase 04 — Door Scanner: Security Audit

**ASVS Level:** 1
**Threats Closed:** 11/11
**Threats Open:** 0/11
**Result:** SECURED

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-4-01 | Spoofing | mitigate | CLOSED | `auth.js:19-24` — `compareStrings()` wraps `timingSafeEqual(Buffer.from(a,'utf8'), Buffer.from(b,'utf8'))` in try/catch; catch returns false on length mismatch. All three call sites verified: `auth.js:40` (middleware), `scan.js:29` (POST /scan/login), `scan.js:49,95` (inline API checks). |
| T-4-02 | Tampering | mitigate | CLOSED | `scan.js:32-37` — `res.cookie()` sets `httpOnly: true`, `sameSite: 'strict'`, `secure: process.env.NODE_ENV === 'production'`. Token is `HMAC-SHA256('powder-rhythm-scan', ADMIN_PASSWORD)` via `makeToken()` in `auth.js:11-13`. |
| T-4-03 | Info Disclosure | accept | CLOSED | Accepted risk documented below. `secure` flag conditioned on `NODE_ENV === 'production'` — cookie sent in plaintext only in dev/localhost; Railway prod enforces HTTPS. |
| T-4-04 | Spoofing | accept | CLOSED | Accepted risk documented below. `compareStrings` prevents timing oracle; rate limiting deferred to Phase 6 (SEC-04). |
| T-4-05 | EoP | mitigate | CLOSED | `auth.js:35-37` — `if (!password) return res.status(500).send('ADMIN_PASSWORD not configured')` executes before `next()` or redirect; fails closed. Also guarded in `scan.js:25-27` (POST /scan/login) and `scan.js:49,95` (inline API checks via `!password` short-circuit). |
| T-4-06 | Tampering | accept | CLOSED | Accepted risk documented below. CDN reference pinned to exact version: `scan.ejs:179` — `https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js`. |
| T-4-SC | Tampering | mitigate | CLOSED | Human checkpoint gate completed (04-01-PLAN.md Task 1 approved). `package.json:14` — `"cookie-parser": "1.4.7"` (exact pin, no caret). |
| T-4-07 | Tampering | mitigate | CLOSED | `scan.js:63-66` — `db('tickets').where({ uuid, status: 'confirmed' }).whereNull('scanned_at').update({ scanned_at: db.fn.now() })`. No `.returning()` chained (line 62 is comment-only). `rowsAffected === 1` check at line 68. |
| T-4-08 | Spoofing | mitigate | CLOSED | `scan.js:47-51` (POST /api/scan) and `scan.js:93-97` (GET /api/scan/search) — inline `if (!password \|\| !token \|\| !compareStrings(token, makeToken(password))) return res.status(401).json({ error: 'Unauthorized' })` before any DB access. Returns JSON (not redirect) so `fetch()` callers can parse the error. |
| T-4-09 | Info Disclosure | accept | CLOSED | Accepted risk documented below. `scan.js:70-71` — `select('buyer_name')` only; `buyer_email` is not selected or returned from POST /api/scan response. |
| T-4-10 | Info Disclosure | accept | CLOSED | Accepted risk documented below. Both API endpoints auth-gated (T-4-08 verified). Rate limiting deferred to Phase 6. |
| T-4-11 | Injection | mitigate | CLOSED | `scan.js:101` — minimum-length guard (`q.trim().length < 2`). `scan.js:109` — `safeTerm = term.replace(/[%_\\]/g, '\\$&')` escapes LIKE metacharacters. `scan.js:115-121` — `whereILike` with `safeTerm` bound as parameter. `scan.js:124-133` — `whereRaw('LOWER(buyer_name) LIKE ? ESCAPE ...' , ['%' + safeTerm.toLowerCase() + '%'])` fallback; parameterized, no string concatenation into SQL. |

---

## Accepted Risks Log

| Threat ID | Category | Risk | Accepted Disposition |
|-----------|----------|------|---------------------|
| T-4-03 | Info Disclosure | `scan_auth` cookie transmitted over HTTP when `NODE_ENV !== 'production'`. An attacker on the same LAN during local dev testing could intercept the cookie and reuse it. | Accepted for dev/localhost only. Railway production deployment enforces HTTPS. Staff scanner is not used on untrusted networks in production. Deferred to Phase 6 if HSTS enforcement is added. |
| T-4-04 | Spoofing | No rate limiting on POST /scan/login. An attacker can submit unlimited password guesses. `timingSafeEqual` prevents timing oracle but does not prevent brute force. | Accepted. ADMIN_PASSWORD entropy is venue owner's responsibility. Rate limiting scheduled for Phase 6 (SEC-04). Single shared credential model limits exposure. |
| T-4-06 | Tampering | `qr-scanner@1.4.2` loaded from jsDelivr CDN without Subresource Integrity (SRI) hash. CDN compromise would execute attacker script in the staff browser scanner session. | Accepted for MVP. jsDelivr + nimiq org verified at research time. CDN substitution risk accepted for a staff-only local venue tool. SRI can be added post-MVP. |
| T-4-09 | Info Disclosure | `buyer_name` returned to authenticated scanner session in POST /api/scan response. Name is PII. | Accepted. Endpoint is auth-gated via scan_auth cookie. `buyer_email` is explicitly excluded from the response. Exposure is limited to authenticated door staff. |
| T-4-10 | Info Disclosure | GET /api/scan/search returns `buyer_email` and `uuid` to authenticated scanner. Search by partial name/email could be used to enumerate attendee list. | Accepted. Endpoint is auth-gated. UUID v4 space (2^122 values) makes pure UUID enumeration impractical. Rate limiting deferred to Phase 6 (SEC-04). |

---

## Unregistered Flags

Two issues were identified during the code review phase (04-REVIEW.md) that were not in the original threat register. Both were fixed before this security audit and are recorded here for traceability.

| Flag ID | Description | Status |
|---------|-------------|--------|
| CR-01 (unregistered) | POST /api/scan accepted unconfirmed (unpaid/pending) tickets. An attacker with a pending ticket UUID could scan in without paying. | Fixed in `scan.js` — `status: 'confirmed'` added to both the atomic UPDATE and the fallback SELECT (`scan.js:64,76`). Not a BLOCKER at audit time. |
| CR-02 (unregistered) | Stored XSS: search results from GET /api/scan/search were injected via `innerHTML` string concatenation in scan.ejs, allowing a buyer_name or buyer_email containing `<script>` tags to execute in the staff browser. | Fixed in `scan.ejs` — replaced innerHTML pattern with `createElement` + `textContent` DOM construction (`scan.ejs:255-271`). Not a BLOCKER at audit time. |

Both fixes are confirmed present in the audited implementation files.

---

## Files Audited

| File | Purpose |
|------|---------|
| `ticketing/src/middleware/auth.js` | makeAuthMiddleware factory, makeToken, compareStrings |
| `ticketing/src/routes/scan.js` | All scan routes: GET /scan, GET /scan/login, POST /scan/login, POST /api/scan, GET /api/scan/search |
| `ticketing/src/views/scan.ejs` | Camera viewfinder, result overlay, search fallback |
| `ticketing/src/views/scan-login.ejs` | Password login form |
| `ticketing/index.js` | Middleware mount order (cookie-parser, scan router) |
| `ticketing/test/scan-api.test.js` | 11 unit tests covering auth, UUID validation, atomic scan, and search |
| `ticketing/package.json` | Dependency version pins |
