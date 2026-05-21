---
phase: 04-door-scanner
verified: 2026-05-20T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Navigate to /scan on a phone over HTTPS without authenticating — verify it shows the Scanner Login page"
    expected: "Login form renders with 'Scanner Login' heading and Password field"
    why_human: "Redirect behavior from a real browser on mobile requires live server; curl follows redirects and the test needs visual confirmation of the rendered login page on a phone viewport"
  - test: "Authenticate at /scan/login with the correct ADMIN_PASSWORD, then point the phone camera at a valid confirmed ticket QR code"
    expected: "Camera activates (no app install required); full-screen green overlay appears with the buyer's name"
    why_human: "Camera activation requires a physical device with a camera; QR decode requires real QR code and physical scan; green overlay visual confirmation is not testable via curl/grep"
  - test: "Scan the same ticket a second time"
    expected: "Full-screen red overlay with 'Already scanned' and the time of the first scan"
    why_human: "Requires physical camera scan sequence; visual color and timestamp display cannot be verified programmatically"
  - test: "Scan a QR code from a non-ticket source (e.g., a website URL)"
    expected: "Full-screen red overlay with 'Not a ticket' or 'Not found' message"
    why_human: "Requires physical device and real QR code; URL regex match behavior on non-ticket codes needs live test"
  - test: "On the scan page, expand 'Can't scan? Search by name', type 2+ characters of a buyer name, and tap 'Check In' on a result"
    expected: "Results appear in the dropdown without XSS; tapping Check In shows the green or red overlay"
    why_human: "Requires live server with real data; DOM construction via textContent (XSS fix CR-02) only verifiable by inspecting rendered output in a real browser"
---

# Phase 4: Door Scanner Verification Report

**Phase Goal:** A staff member with a phone can scan a ticket QR code and immediately see whether it is valid or already used.
**Verified:** 2026-05-20T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /scan without a valid scan_auth cookie redirects to /scan/login | VERIFIED | `requireScanAuth = makeAuthMiddleware('scan_auth')` applied to `router.get('/scan', requireScanAuth, ...)` in scan.js:14; middleware redirects to /scan/login when cookie absent or invalid |
| 2 | GET /scan/login renders a password form with heading 'Scanner Login' | VERIFIED | scan-login.ejs:124 contains `<h1>Scanner Login</h1>`; form action="/scan/login" method="POST" with password input at line 126-128 |
| 3 | POST /scan/login with wrong password re-renders login with 'Wrong password. Try again.' | VERIFIED | scan.js:30 `return res.render('scan-login', { error: 'Wrong password. Try again.' })` using timing-safe compareStrings |
| 4 | POST /scan/login with correct password sets httpOnly cookie and redirects to /scan | VERIFIED | scan.js:32-38 sets cookie with httpOnly:true, sameSite:strict, secure:true in production; then redirects to /scan |
| 5 | GET /scan renders camera UI with playsinline video element and qr-scanner@1.4.2 CDN import | VERIFIED | scan.ejs:161 `<video id="qr-video" playsinline autoplay muted aria-hidden="true">`; line 179 `import QrScanner from 'https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js'` |
| 6 | POST /api/scan with valid unscanned UUID returns {ok:true, name} and sets scanned_at atomically | VERIFIED | scan.js:63-71: atomic `db('tickets').where({uuid, status:'confirmed'}).whereNull('scanned_at').update({scanned_at:db.fn.now()})`; unit test passes (11/11 green) |
| 7 | POST /api/scan with already-scanned UUID returns {ok:false, reason:'already_scanned', scannedAt} | VERIFIED | scan.js:76-80: rowsAffected===0 path fetches scanned_at and returns reason; unit test passes |
| 8 | POST /api/scan with unknown UUID returns {ok:false, reason:'not_found'} | VERIFIED | scan.js:77-79; unit test passes |
| 9 | POST /api/scan without cookie returns 401 JSON (not HTML redirect) | VERIFIED | scan.js:49-51: inline auth check returns `res.status(401).json({error:'Unauthorized'})`; unit test passes |
| 10 | POST /api/scan with malformed UUID returns 400 {error:'Invalid uuid'} | VERIFIED | scan.js:55-57 UUID_RE validation; unit test passes |
| 11 | Atomic UPDATE WHERE scanned_at IS NULL prevents double-scan | VERIFIED | scan.js:63-66: single UPDATE with `.where({uuid, status:'confirmed'}).whereNull('scanned_at')` — no .returning() chained; integer rowsAffected gate ensures exactly one success |
| 12 | GET /api/scan/search returns auth-gated JSON array of confirmed ticket matches | VERIFIED | scan.js:90-141: inline auth, min-length guard, whereILike/whereRaw with parameterized LIKE, .limit(20), status:'confirmed' filter |
| 13 | Search results rendered without XSS (CR-02 fix applied) | VERIFIED | scan.ejs:255-272: searchResults.innerHTML=''; followed by createElement+textContent DOM construction — no innerHTML string concatenation |
| 14 | Unconfirmed (pending) tickets cannot be scanned in (CR-01 fix applied) | VERIFIED | scan.js:64: `.where({uuid, status:'confirmed'})` on atomic UPDATE; same guard on fallback SELECT at line 76 |

**Score:** 5/5 ROADMAP success criteria verified (14/14 truths verified)

### ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Navigating to /scan without correct password shows login prompt; correct password grants access (SCAN-01) | VERIFIED | Truths 1, 3, 4 |
| 2 | Scan page activates phone camera and reads QR code without app install (SCAN-02) | VERIFIED (partial) | scan.ejs has playsinline video, qr-scanner@1.4.2 CDN import, returnDetailedScanResult:true — camera activation on real device requires human verification |
| 3 | Valid unscanned ticket shows full-screen green with buyer's name (SCAN-03) | VERIFIED (partial) | scan.js returns {ok:true, name}; scan.ejs show('green', ...) handler uses #00c853 background — visual rendering on phone requires human verification |
| 4 | Already-scanned ticket shows full-screen red with time first scanned (SCAN-03) | VERIFIED (partial) | scan.js returns {ok:false, reason:'already_scanned', scannedAt}; scan.ejs shows red #d50000 with time — visual rendering on phone requires human verification |
| 5 | Atomic UPDATE WHERE scanned_at IS NULL — two simultaneous scans cannot both succeed (SEC-03) | VERIFIED | scan.js:63-66 atomic pattern; no .returning(); rowsAffected integer gate |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ticketing/src/middleware/auth.js` | makeAuthMiddleware factory + makeToken + compareStrings | VERIFIED | Exports all three + COOKIE_MAX_AGE; node assertion confirms at runtime |
| `ticketing/src/views/scan-login.ejs` | Password login form | VERIFIED | 138 lines; contains 'Scanner Login', 'Unlock Scanner', EJS error conditional |
| `ticketing/src/views/scan.ejs` | Camera UI + result overlay + search fallback | VERIFIED | 277 lines; playsinline, qr-scanner@1.4.2, returnDetailedScanResult, result-overlay, role="alert", "Can't scan?" |
| `ticketing/src/routes/scan.js` | All 5 routes (GET /scan, GET /scan/login, POST /scan/login, POST /api/scan, GET /api/scan/search) | VERIFIED | 143 lines; module loads cleanly |
| `ticketing/index.js` | cookie-parser + scan router mounted | VERIFIED | Line 23: `app.use(require('cookie-parser')())`; line 32: `app.use('/', require('./src/routes/scan'))` |
| `ticketing/test/scan-api.test.js` | 11-test suite for API endpoints | VERIFIED | 11/11 tests pass via `node --test` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ticketing/index.js` | `ticketing/src/routes/scan.js` | `app.use('/', require('./src/routes/scan'))` | WIRED | Line 32 of index.js |
| `ticketing/index.js` | cookie-parser | `app.use(require('cookie-parser')())` | WIRED | Line 23, before all routes |
| `ticketing/src/routes/scan.js` | `ticketing/src/middleware/auth.js` | `const { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE } = require('../middleware/auth')` | WIRED | Line 6 of scan.js; WR-01 resolved — no local redeclaration |
| `ticketing/src/views/scan.ejs` | qr-scanner@1.4.2 CDN | `import QrScanner from 'https://cdn.jsdelivr.net/.../qr-scanner.min.js'` | WIRED | Line 179 of scan.ejs |
| `ticketing/src/routes/scan.js POST /api/scan` | `ticketing/src/db/knex.js` | `db('tickets').where({uuid,status:'confirmed'}).whereNull('scanned_at').update(...)` | WIRED | Lines 63-66 of scan.js |
| `ticketing/src/routes/scan.js GET /api/scan/search` | `ticketing/src/db/knex.js` | `db('tickets').where({status:'confirmed'}).andWhere(whereILike...).limit(20)` | WIRED | Lines 115-122 of scan.js |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `scan.ejs` handleScan() | `j.name`, `j.reason`, `j.scannedAt` | `fetch('/api/scan', POST)` | Yes — server returns DB-sourced buyer_name and scanned_at | FLOWING |
| `scan.ejs` search handler | `items[]` (buyer_name, buyer_email, uuid) | `fetch('/api/scan/search?q=...')` | Yes — server queries confirmed tickets with whereILike | FLOWING |
| `scan.js POST /api/scan` | `ticket.buyer_name`, `ticket.scanned_at` | `db('tickets').where({uuid}).first()` | Yes — live DB SELECT after atomic UPDATE | FLOWING |
| `scan.js GET /api/scan/search` | `rows[]` | `db('tickets').where({status:'confirmed'}).andWhere(whereILike...)` | Yes — parameterized LIKE against DB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| auth.js exports all three functions + COOKIE_MAX_AGE | `node -e "const a=require('./src/middleware/auth');console.assert(typeof a.makeAuthMiddleware==='function')"` | Exits 0, prints OK | PASS |
| scan.js loads without error | `node -e "require('./src/routes/scan.js'); console.log('OK')"` | Exits 0, prints OK | PASS |
| 11/11 unit tests pass | `node --test test/scan-api.test.js` | 11 pass, 0 fail | PASS |
| whereNull('scanned_at') present in scan.js | `grep -c "whereNull('scanned_at')" scan.js` | 2 (atomic UPDATE + comment) | PASS |
| No .returning() in executable code | `grep -n "\.returning(" scan.js` | Line 62 is a comment only | PASS |
| cookie-parser exact pin in package.json | `grep cookie-parser package.json` | `"cookie-parser": "1.4.7"` | PASS |
| XSS fix: search results use createElement not innerHTML | `grep -n "createElement" src/views/scan.ejs` | Lines 257-260 createElement DOM construction | PASS |
| CR-01 fix: status:'confirmed' guard in atomic UPDATE | `grep -c "status: 'confirmed'" src/routes/scan.js` | 6 occurrences | PASS |

### Probe Execution

No probe scripts discovered at `scripts/*/tests/probe-*.sh`. Step 7c: SKIPPED (no conventional probe scripts for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCAN-01 | 04-01-PLAN.md | Scanner page at /scan is protected by a shared password (env var) | SATISFIED | makeAuthMiddleware gates GET /scan; POST /scan/login sets httpOnly HMAC cookie |
| SCAN-02 | 04-01-PLAN.md | Staff can scan QR code using phone camera (browser-based, qr-scanner by nimiq) | SATISFIED | scan.ejs: playsinline video, qr-scanner@1.4.2 CDN, returnDetailedScanResult, preferredCamera:'environment' |
| SCAN-03 | 04-02-PLAN.md | Scanner displays full-screen green with buyer name / full-screen red with reason | SATISFIED | scan.ejs show() function sets #00c853 (green) or #d50000 (red); POST /api/scan returns {ok:true, name} or {ok:false, reason, scannedAt} |
| SEC-03 (scan atomicity) | 04-02-PLAN.md | Scan enforced atomically — single UPDATE WHERE scanned_at IS NULL | SATISFIED | scan.js:63-66 atomic pattern without .returning(); rowsAffected integer gate |
| SEC-03 (capacity at DB level) | Neither plan | "capacity is enforced at DB level (not just app layer)" | PARTIAL — capacity enforcement is app-layer only (events.js:53); no DB-level CHECK constraint or trigger exists. Phase 4 ROADMAP success criteria do not include this concern — it appears to be an aspirational note in the requirements that was not scoped into any plan. SEC-04 (rate limiting) is explicitly deferred to Phase 6. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ticketing/src/db/migrations/20260514_001_initial_schema.js` | 34 | `TODO: Update price_cents and capacity before Phase 6 production deploy` | Info | Not a Phase 4 file; pre-existing from Phase 1. No formal follow-up reference but explicitly scoped to Phase 6. No Phase 4 files contain TBD/FIXME/XXX. |

No debt markers (TBD/FIXME/XXX) were found in any of the five files modified by Phase 4 (scan.js, auth.js, scan.ejs, scan-login.ejs, index.js). The only TODO found was in a Phase 1 migration file not modified by Phase 4.

**Review findings addressed:** All three critical issues (CR-01 unconfirmed ticket bypass, CR-02 stored XSS, CR-03 null dereference) and two warnings (WR-01 COOKIE_MAX_AGE duplication, WR-03 LIKE metacharacter injection) were fixed per REVIEW-FIX.md. WR-02 (no SRI on CDN script) was not in scope (risk accepted per T-4-06 threat register). IN-01 and IN-02 are informational.

### Human Verification Required

The automated layer fully verifies the server-side logic, auth gate, and API contract. The following five items require a physical phone and live server because they depend on camera hardware, browser rendering, or visual feedback that cannot be verified via grep or curl.

#### 1. Password Gate End-to-End

**Test:** On a phone browser, navigate to `/scan` without authenticating
**Expected:** Redirected to `/scan/login`; page renders 'Scanner Login' heading with a password field and 'Unlock Scanner' button
**Why human:** Redirect chain and mobile viewport rendering require a real browser

#### 2. Camera Activation and QR Decode (SCAN-02)

**Test:** After logging in, verify the scan page activates the phone camera without installing any app
**Expected:** Camera viewfinder fills the screen; aim guide box is visible; status bar shows 'Hold QR code inside the frame'
**Why human:** Camera permission, getUserMedia activation, and live QR decode require physical device hardware

#### 3. Valid Ticket — Green Overlay (SCAN-03 first half)

**Test:** Point camera at the QR code from a confirmed ticket (from `/ticket/:uuid`)
**Expected:** Full-screen green background (#00c853) with buyer's name displayed in large text; overlay disappears after ~3 seconds and scanner restarts
**Why human:** Visual color and typography rendering on a phone screen is not verifiable programmatically

#### 4. Already-Scanned Ticket — Red Overlay (SCAN-03 second half)

**Test:** Scan the same ticket a second time
**Expected:** Full-screen red background (#d50000) with 'Already scanned' heading and the timestamp of the first scan displayed
**Why human:** Time display via toLocaleTimeString() and visual appearance require live device

#### 5. Search Fallback — Name Search and Manual Check-In

**Test:** Expand 'Can't scan? Search by name'; type 2+ characters of a known buyer's name; tap 'Check In' on a result
**Expected:** Results appear without HTML injection (XSS fix CR-02 is in place); tapping Check In triggers the scan API and shows the correct green or red overlay
**Why human:** DOM rendering of search results via textContent (CR-02 fix) and the end-to-end check-in flow from search requires a live browser with real DB data

### Gaps Summary

No blocking gaps. All five ROADMAP success criteria are satisfied in the codebase. All 14 derived truths verified. All six key links wired. All five artifacts substantive and wired. 11/11 unit tests pass.

The SEC-03 requirement text includes "capacity is enforced at DB level" which is not addressed in Phase 4 (or any other phase's plan). This is noted as PARTIAL but is not a Phase 4 blocker because the Phase 4 ROADMAP success criteria do not include DB-level capacity enforcement — the ROADMAP scopes SEC-03 Phase 4 exclusively to scan atomicity. This residual concern should be tracked for Phase 6 (Production Hardening).

Status is `human_needed` because the phase goal ("staff member with a phone can scan a ticket QR code and immediately see whether it is valid or already used") is inherently a physical device / visual rendering claim. The server-side implementation is complete and correct; the camera + visual overlay behavior requires live device verification.

---

_Verified: 2026-05-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
