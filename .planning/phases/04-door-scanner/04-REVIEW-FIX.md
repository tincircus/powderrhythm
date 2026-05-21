---
phase: 04-door-scanner
fixed_at: 2026-05-21T03:55:00Z
review_path: .planning/phases/04-door-scanner/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-21T03:55:00Z
**Source review:** .planning/phases/04-door-scanner/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, CR-03, WR-01, WR-03)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Scan endpoint accepts unconfirmed (unpaid) tickets

**Files modified:** `ticketing/src/routes/scan.js`
**Commit:** 0cb6750
**Applied fix:** Added `status: 'confirmed'` to the `.where()` clause on the atomic UPDATE at the POST /api/scan handler so unconfirmed (unpaid/pending) tickets cannot be scanned in. Also added the same guard to the fallback SELECT at Step 5 so the existence of pending tickets is not leaked through the `already_scanned` / `not_found` response distinction.

---

### CR-02: Stored XSS — search results injected into innerHTML without encoding

**Files modified:** `ticketing/src/views/scan.ejs`
**Commit:** 7e81ec8
**Applied fix:** Replaced the `innerHTML` string-concatenation pattern with `createElement` + `textContent` DOM construction. `searchResults.innerHTML = ''` clears the list safely, then each result is built as a `<li>` with a `<span>` (textContent for name/email) and a `<button>` with a directly-attached click event listener. The subsequent `querySelectorAll('.checkin-btn')` pass was removed since listeners are now attached during construction.

---

### CR-03: Null dereference crash after successful atomic scan

**Files modified:** `ticketing/src/routes/scan.js`
**Commit:** 0cb6750 (committed atomically with CR-01)
**Applied fix:** Added null guard `ticket ? ticket.buyer_name : null` on line 72 for the `res.json({ ok: true, name: ... })` response after `rowsAffected === 1`. If the row is deleted between the UPDATE and the follow-up SELECT, the response now returns `name: null` rather than throwing a TypeError.

---

### WR-01: `COOKIE_MAX_AGE` is defined independently in two files

**Files modified:** `ticketing/src/routes/scan.js`
**Commit:** f168796
**Applied fix:** Added `COOKIE_MAX_AGE` to the destructured import from `../middleware/auth` on line 6. Removed the local `const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000` declaration on the former line 9. The value is now sourced from a single location (auth.js), eliminating the silent-drift risk.

---

### WR-03: LIKE wildcard metacharacters (`%`, `_`) are not escaped in search term

**Files modified:** `ticketing/src/routes/scan.js`
**Commit:** 4f13c4e
**Applied fix:**
- Changed the empty-string guard (`length === 0`) to a minimum-length guard (`length < 2`), mirroring the client-side check and blocking bare wildcard queries like `%` or `_`.
- Added `const safeTerm = term.replace(/[%_\\]/g, '\\$&')` after the `term` extraction to escape LIKE metacharacters before interpolation.
- Updated both the `whereILike` primary path and the `whereRaw` fallback path to use `safeTerm` (and `safeTerm.toLowerCase()` in the fallback).
- Added `ESCAPE '\\\\'` clause to both `whereRaw` calls in the fallback path for Postgres and SQLite compatibility.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-21T03:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
