---
phase: 04-door-scanner
plan: 01
subsystem: ticketing/auth + ticketing/scan
tags: [auth, cookie, scan, ejs, express]
dependency_graph:
  requires: []
  provides:
    - makeAuthMiddleware(cookieName) factory in ticketing/src/middleware/auth.js
    - GET /scan (auth-gated camera UI)
    - GET /scan/login (password form)
    - POST /scan/login (cookie set on success)
    - scan-login.ejs (login view)
    - scan.ejs (camera + result overlay view)
  affects:
    - ticketing/index.js (cookie-parser + scan router mounted)
tech_stack:
  added:
    - cookie-parser@1.4.7 (npm, expressjs org)
  patterns:
    - HMAC-SHA256 token in httpOnly cookie for shared-password auth gate
    - makeAuthMiddleware(cookieName) factory pattern (reusable for Phase 5 admin_auth)
    - qr-scanner@1.4.2 delivered from jsDelivr CDN as ES module
    - busy debounce flag + scanner.stop() before async fetch (prevents double-scan)
    - role="alert" on result overlay for screen reader announcement
key_files:
  created:
    - ticketing/src/views/scan-login.ejs
    - ticketing/src/views/scan.ejs
  modified:
    - ticketing/src/middleware/auth.js
    - ticketing/src/routes/scan.js
    - ticketing/index.js
    - ticketing/package.json
    - ticketing/package-lock.json
decisions:
  - Cookie token is HMAC-SHA256 of 'powder-rhythm-scan' constant, signed with ADMIN_PASSWORD as key — unforgeable without the key, no extra secret needed
  - COOKIE_MAX_AGE exported from auth.js so scan.js and future admin.js share the same constant
  - Result overlay colors (#00c853 green, #d50000 red) set only via JS style.background — not added to :root token namespace
  - scan.ejs body background:#000 prevents flash of deep-purple before camera activates
metrics:
  duration: "201s"
  completed: "2026-05-21T03:25:22Z"
  tasks_completed: 2
  files_changed: 7
---

# Phase 4 Plan 01: Cookie Auth Gate and Scan Views Summary

Password-gated scan page with HMAC cookie auth, qr-scanner@1.4.2 CDN camera UI, collapsed search fallback, and full-screen result overlay.

## What Was Built

**Task 2 — cookie-parser install and makeAuthMiddleware factory:**
- Installed cookie-parser@1.4.7 (exact pin, expressjs org, approved by human checkpoint)
- Replaced auth.js stub entirely with `makeAuthMiddleware(cookieName)` factory pattern
- `makeToken(password)` — HMAC-SHA256 signs 'powder-rhythm-scan' constant with password as key, returns 64-char hex
- `compareStrings(a, b)` — timing-safe via `crypto.timingSafeEqual`, catch block returns false on length mismatch
- `makeAuthMiddleware(cookieName)` — factory returns `requireAuth` middleware; returns 500 when ADMIN_PASSWORD unset (fails closed per T-4-05), redirects to /scan/login when cookie absent or invalid

**Task 3 — views, routes, index.js wiring:**
- `scan-login.ejs` — Powder Rhythm aesthetic: deep-purple background with radial gradients, neon-teal form card border, Special Elite body font, Fredoka One heading, error display via EJS conditional
- `scan.ejs` — Full-viewport camera UI: fixed video#qr-video with playsinline, aim guide overlay, status bar, result overlay with role="alert", collapsed "Can't scan?" search fallback
- `scan.js` — GET /scan (requireScanAuth gate), GET /scan/login, POST /scan/login (compareStrings check, httpOnly SameSite:Strict cookie on success)
- `index.js` — cookie-parser mounted after express.urlencoded; scan router mounted after ticketsRouter

## Verification Results

All 6 smoke tests passed against running server (ADMIN_PASSWORD=testpass):
1. GET /scan (unauthenticated) → follows redirect → renders "Scanner Login" heading
2. GET /scan/login → renders login form with "Scanner Login"
3. POST /scan/login with wrong password → renders form with "Wrong password. Try again."
4. POST /scan/login with correct password → Set-Cookie: scan_auth=...; HttpOnly; SameSite=Strict
5. GET /scan with valid cookie → renders scan page with video#qr-video
6. Module load (node -e require) → OK

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 2: cookie-parser + auth.js factory | 1c88636 | package.json, package-lock.json, auth.js |
| Task 3: scan views, routes, index.js wiring | b3ce4e7 | scan-login.ejs, scan.ejs, scan.js, index.js |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pin exact cookie-parser version in package.json**
- **Found during:** Task 2
- **Issue:** `npm install cookie-parser@1.4.7` wrote `"^1.4.7"` (caret range) to package.json instead of exact pin
- **Fix:** Changed to `"1.4.7"` (exact) to match plan requirement and prior qrcode precedent (1.5.4 exact pin in Phase 3)
- **Files modified:** ticketing/package.json
- **Commit:** 1c88636

**2. [Rule 1 - Bug] Worktree branch rebased onto main before execution**
- **Found during:** Pre-execution setup
- **Issue:** Worktree was created from an older commit (e3ca940) before the ticketing directory existed in history. The ticketing/ directory was absent from the worktree.
- **Fix:** Ran `git rebase main` to bring the worktree branch up to date. No conflicts. Rebasing was safe because the worktree branch had no commits of its own yet.
- **Impact:** No code changes; execution environment correction only.

**3. [Rule 2 - Missing critical functionality] Export COOKIE_MAX_AGE from auth.js**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified COOKIE_MAX_AGE declared locally in auth.js, but scan.js also needs the same constant. Without exporting it, both files would declare their own constants independently — potential for drift.
- **Fix:** Added COOKIE_MAX_AGE to `module.exports` alongside the three functions. scan.js imports it directly.
- **Files modified:** ticketing/src/middleware/auth.js

## Known Stubs

None. All plan goals are fully implemented. scan.js currently only has the page routes (GET /scan, GET /scan/login, POST /scan/login). The scan API endpoints (POST /api/scan, GET /api/scan/search) are implemented in Plan 02 per the plan split.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's threat model. All T-4-0x mitigations are implemented:
- T-4-01: compareStrings uses crypto.timingSafeEqual
- T-4-02: scan_auth cookie has httpOnly:true; HMAC token unforgeable without ADMIN_PASSWORD
- T-4-05: makeAuthMiddleware returns 500 (not next()) when ADMIN_PASSWORD unset

## Self-Check: PASSED

Files created/modified confirmed present:
- ticketing/src/middleware/auth.js — exists, exports makeAuthMiddleware/makeToken/compareStrings
- ticketing/src/views/scan-login.ejs — exists, contains "Scanner Login", "Unlock Scanner"
- ticketing/src/views/scan.ejs — exists, contains qr-scanner@1.4.2, playsinline, result-overlay, role="alert"
- ticketing/src/routes/scan.js — exists, loads without error
- ticketing/index.js — contains cookie-parser, scan router mount
- ticketing/package.json — contains "cookie-parser": "1.4.7"

Commits confirmed:
- 1c88636 — feat(04-01): install cookie-parser and implement makeAuthMiddleware factory
- b3ce4e7 — feat(04-01): create scan views, routes, and wire cookie-parser in index.js
