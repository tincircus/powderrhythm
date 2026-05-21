---
phase: 05-admin-panel
verified: 2026-05-21T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /admin without a cookie in a browser and confirm redirect to /admin/login login page is shown"
    expected: "Browser shows the Admin Login page with the form, not an error page"
    why_human: "Redirect behavior and page render correctness require a browser; curl can confirm 302 but cannot confirm EJS renders correctly"
  - test: "Submit the wrong password at /admin/login and confirm the error message appears"
    expected: "Page re-renders with error text 'Wrong password. Try again.' visible in pink below the password field"
    why_human: "EJS error conditional rendering requires visual confirmation"
  - test: "Submit the correct ADMIN_PASSWORD and confirm redirect to /admin with attendee table"
    expected: "Admin page loads showing headcount banner (e.g. '0 / 0 attendees confirmed') and the table with any confirmed tickets"
    why_human: "Cookie-set-then-redirect flow and DB-driven table rendering require browser and live DB"
  - test: "Type a partial name in the search box and confirm non-matching rows hide instantly"
    expected: "Rows whose buyer_name does not include the query string disappear without a page reload"
    why_human: "Client-side DOM manipulation requires a browser with real rows; static grep cannot confirm runtime behavior"
  - test: "Clear the search input and confirm all rows reappear"
    expected: "All attendee rows visible again with no page reload"
    why_human: "DOM state reset behavior requires browser"
  - test: "Click 'Check In' on an unchecked attendee row and confirm in-place update"
    expected: "Badge changes from 'Not checked in' to 'Checked in' (green), scan time column populates with time, button becomes 'Done' label — no page reload"
    why_human: "Fetch-based row mutation requires browser and live /api/admin/checkin endpoint with a real DB row"
  - test: "Click 'Check In' rapidly twice and confirm double-tap protection"
    expected: "Button becomes disabled (dimmed) immediately on first click; second click is ignored while fetch is in flight"
    why_human: "Button disabled state during in-flight fetch requires browser and network timing"
---

# Phase 5: Admin Panel Verification Report

**Phase Goal:** Venue staff can see every attendee, live headcount, and manually check in anyone whose QR code will not scan.
**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to /admin without a cookie redirects to /admin/login | VERIFIED | `makeAuthMiddleware('admin_auth', '/admin/login')` called at line 11 of admin.js; middleware redirects to `loginPath` when cookie is absent (auth.js line 46); confirmed via `ADMIN_PASSWORD=testpass node` test: redirected to `/admin/login` |
| 2 | Submitting the correct password at /admin/login sets admin_auth cookie and redirects to /admin | VERIFIED | POST /admin/login (admin.js lines 19-34): `compareStrings` validates password, sets `admin_auth` httpOnly cookie via `makeToken`, then `res.redirect('/admin')` |
| 3 | Submitting the wrong password re-renders admin-login.ejs with 'Wrong password. Try again.' | VERIFIED | admin.js line 25: `res.render('admin-login', { error: 'Wrong password. Try again.' })` — exact string match confirmed |
| 4 | GET /admin renders the attendee table with all confirmed ticket rows | VERIFIED | admin.js lines 39-47: queries `db('tickets').where({ status: 'confirmed' })` and passes `attendees` array to `res.render('admin', ...)`. admin.ejs lines 219-245: `attendees.forEach` renders each row with `data-name`, `data-uuid`, badge, scan time, and action cells |
| 5 | The headcount banner shows correct checked-in vs total-sold counts from the DB | VERIFIED | admin.js lines 44-45: `checkedIn = attendees.filter(t => t.scanned_at !== null).length`, `totalSold = attendees.length`. admin.ejs line 194: `<%= checkedIn %> / <%= totalSold %>` — both computed from real DB query results |
| 6 | Scan routes are unaffected — GET /scan still redirects to /scan/login when unauthenticated | VERIFIED | scan.js line 11: `makeAuthMiddleware('scan_auth')` — no second argument, default loginPath remains `/scan/login`. Confirmed via `ADMIN_PASSWORD=testpass node` test |
| 7 | Typing in the search box instantly hides rows whose buyer_name does not contain the query | VERIFIED | admin.ejs lines 258-269: 'input' event listener on `#search-input`; iterates `tr` elements in `#attendee-tbody`; sets `tr.style.display = ''` or `'none'` based on `tr.dataset.name.includes(query)` |
| 8 | Clearing the search input restores all rows | VERIFIED | Same search handler: when `query` is empty string, `tr.dataset.name.includes('')` is always true, so all rows get `display = ''` |
| 9 | Clicking 'Check In' marks attendee checked in without a page reload | VERIFIED | admin.ejs lines 284-287: `fetch('/api/admin/checkin/' + uuid, { method: 'POST', ... })` — no `window.location` reload; response handled in-place |
| 10 | After successful check-in the row updates: badge becomes 'Checked in', scan time populates, button becomes 'Done' label | VERIFIED | admin.ejs lines 297-313: on `response.ok` or 409, updates `statusTd.innerHTML` to badge-checked, formats `new Date(data.scanned_at).toLocaleTimeString()`, replaces action td with `done-label` span |
| 11 | A double-tap cannot submit the check-in twice — button is disabled while fetch is in flight | VERIFIED | admin.ejs line 282: `button.disabled = true` before `fetch()`; button re-enabled only on failure paths (lines 315-316, 320-321) |
| 12 | POST /api/admin/checkin/:uuid with no valid admin_auth cookie returns 401 JSON | VERIFIED | admin.js lines 59-63: inline auth block checks `req.cookies[COOKIE_NAME]` and returns `res.status(401).json({ error: 'Unauthorized' })` when missing or invalid |
| 13 | POST /api/admin/checkin/:uuid for an already-checked-in ticket returns 409 JSON with scanned_at | VERIFIED | admin.js lines 83-91: zero rows affected branch SELECTs the ticket; if found returns `res.status(409).json({ already_checked_in: true, scanned_at: ticket.scanned_at })` |
| 14 | POST /api/admin/checkin/:uuid for an unknown UUID returns 404 JSON | VERIFIED | admin.js lines 88-89: if SELECT returns no row returns `res.status(404).json({ error: 'not_found' })` |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ticketing/src/middleware/auth.js` | Extended makeAuthMiddleware factory with loginPath param | VERIFIED | Line 35: `function makeAuthMiddleware(cookieName, loginPath = '/scan/login')`. Line 46: `return res.redirect(loginPath)`. JSDoc updated at lines 28-34. |
| `ticketing/src/routes/admin.js` | GET /admin, GET /admin/login, POST /admin/login, POST /api/admin/checkin/:uuid | VERIFIED | All 4 routes registered and confirmed via node route stack inspection. Full implementation with DB queries, inline auth, atomic UPDATE. |
| `ticketing/src/views/admin-login.ejs` | Password gate form for admin | VERIFIED | Title "Admin Login — Powder Rhythm" (line 6), h1 "Admin Login" (line 124), form action "/admin/login" (line 126), button "Unlock Admin" (line 132), `locals.error` guard at lines 129-131. |
| `ticketing/src/views/admin.ejs` | Attendee table with headcount banner, search input, client-side JS | VERIFIED | 338 lines. Headcount banner (lines 192-197), search input (lines 198-199), data-name on tr (line 220), data-uuid on buttons (line 239), IIFE script block (lines 252-336) with search filter and check-in fetch. |
| `ticketing/index.js` | Admin router mounted after scan router | VERIFIED | Lines 32-33: `app.use('/', require('./src/routes/scan'))` followed by `app.use('/', require('./src/routes/admin'))`. Correct ordering maintained. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ticketing/src/routes/admin.js` | `ticketing/src/middleware/auth.js` | `makeAuthMiddleware('admin_auth', '/admin/login')` | WIRED | admin.js line 11: `const requireAdminAuth = makeAuthMiddleware('admin_auth', '/admin/login')` |
| `ticketing/index.js` | `ticketing/src/routes/admin.js` | `require('./src/routes/admin')` | WIRED | index.js line 33: `app.use('/', require('./src/routes/admin'))` |
| `ticketing/src/routes/admin.js` | `ticketing/src/db/knex.js` | `db('tickets').where({ status: 'confirmed' })` | WIRED | admin.js lines 39-42: full query with `where`, `orderBy`, `select`; also atomic update at lines 72-75 |
| `ticketing/src/views/admin.ejs (client JS)` | `POST /api/admin/checkin/:uuid` | `fetch('/api/admin/checkin/' + uuid, ...)` | WIRED | admin.ejs line 284: `fetch('/api/admin/checkin/' + uuid, { method: 'POST', ... })` |
| `POST /api/admin/checkin/:uuid` | `ticketing/src/db/knex.js` | `db('tickets').whereNull('scanned_at').update(...)` | WIRED | admin.js lines 72-75: `db('tickets').where({ uuid, status: 'confirmed' }).whereNull('scanned_at').update({ scanned_at: db.fn.now() })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `admin.ejs` headcount banner | `checkedIn`, `totalSold` | `db('tickets').where({ status: 'confirmed' })` in admin.js | Yes — computed from live DB query result | FLOWING |
| `admin.ejs` attendee table | `attendees` array | Same DB query in admin.js, passed via `res.render('admin', { attendees })` | Yes — real rows from tickets table | FLOWING |
| `admin.ejs` client-side check-in | `data.scanned_at` | `POST /api/admin/checkin/:uuid` returns JSON with real DB `scanned_at` timestamp | Yes — set by DB `fn.now()` then fetched and returned | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| makeAuthMiddleware backward compat | `ADMIN_PASSWORD=testpass node -e "... m1 redirects to /scan/login"` | `/scan/login` | PASS |
| makeAuthMiddleware admin path | `ADMIN_PASSWORD=testpass node -e "... m2 redirects to /admin/login"` | `/admin/login` | PASS |
| Admin router exports 4 routes | `node -e "require('./src/routes/admin').stack.map(...)"` | 4 routes confirmed | PASS |
| whereNull('scanned_at') present | `grep -n "whereNull" admin.js` | Lines 74, 74 confirmed | PASS |
| Wrong password error message | `grep "Wrong password" admin.js` | Line 25 confirmed | PASS |
| search-input occurrences | `grep -c "search-input" admin.ejs` | 5 | PASS |
| api/admin/checkin occurrences | `grep -c "api/admin/checkin" admin.ejs` | 1 | PASS |
| button.disabled occurrences | `grep -c "button.disabled" admin.ejs` | 3 | PASS |
| toLocaleTimeString present | `grep -c "toLocaleTimeString" admin.ejs` | 1 | PASS |
| role="alert" present | `grep -c 'role="alert"' admin.ejs` | 1 | PASS |

### Probe Execution

No probes declared for this phase. Phase 5 is not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 05-01-PLAN.md | Admin page at /admin is protected by shared password | SATISFIED | makeAuthMiddleware('admin_auth', '/admin/login') gates GET /admin; login routes implemented with compareStrings timing-safe check |
| ADMIN-02 | 05-01-PLAN.md | Admin displays all attendees with name, email, paid status, scan time; live headcount shown | SATISFIED | GET /admin queries confirmed tickets with buyer_name, buyer_email, scanned_at; headcount computed and rendered in banner; table renders all columns |
| ADMIN-03 | 05-02-PLAN.md | Admin can manually mark attendee as checked in when QR code fails | SATISFIED | POST /api/admin/checkin/:uuid implemented with atomic whereNull update; client-side fetch in admin.ejs updates row in place |
| ADMIN-04 | 05-02-PLAN.md | Admin has client-side name search/filter | SATISFIED | Search 'input' event listener in admin.ejs filters by data-name attribute on each tr; instant, no page reload |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ticketing/src/routes/admin.js` | 55 | Comment reads "Placeholder: inline auth + atomic UPDATE" | INFO | Word "Placeholder" is used as a design pattern descriptor, not a code stub marker. The full implementation follows immediately at lines 56-96. No impact on functionality. |
| `ticketing/src/views/admin.ejs` | 199 | `placeholder="Search by name"` | INFO | HTML input placeholder attribute — not a code debt marker. Expected and correct. |

No TBD, FIXME, or XXX markers found in any Phase 5 modified file.

### Human Verification Required

The following behaviors require a browser and a live running server to confirm. Automated code inspection confirms all wiring is correct; these checks validate the runtime experience.

### 1. Admin Login Redirect

**Test:** Navigate to `http://localhost:3000/admin` without any cookie in a fresh browser window.
**Expected:** Browser redirects to `/admin/login` and shows the Admin Login page with "Admin Login" heading and the password form.
**Why human:** EJS template rendering, cookie state, and redirect follow-through require a live browser.

### 2. Wrong Password Error Display

**Test:** At `/admin/login`, submit an incorrect password.
**Expected:** Page re-renders (not a redirect) with the error message "Wrong password. Try again." in pink text below the password field.
**Why human:** EJS conditional rendering of the error block requires visual confirmation.

### 3. Correct Password Login and Attendee Table

**Test:** Submit the correct `ADMIN_PASSWORD` at `/admin/login`.
**Expected:** Redirects to `/admin`. Page shows the headcount banner (e.g. "0 / 0 attendees confirmed") and the attendee table (or empty state if no confirmed tickets exist).
**Why human:** Cookie set + redirect + DB-driven table render requires live browser and DB state.

### 4. Real-Time Search Filter

**Test:** With at least one confirmed ticket in the DB, load `/admin` and type a partial name that matches one attendee.
**Expected:** Non-matching rows disappear instantly without any page reload. Matching rows remain visible.
**Why human:** Client-side DOM manipulation during user input requires a browser with real rows rendered.

### 5. Search Clear Restores All Rows

**Test:** After filtering with a search term, clear the input (select all + delete or backspace to empty).
**Expected:** All attendee rows reappear without a page reload.
**Why human:** DOM state reset on empty input requires browser runtime.

### 6. Manual Check-In Row Update

**Test:** Click "Check In" on an unchecked attendee row.
**Expected:** Badge changes from "Not checked in" (grey) to "Checked in" (green), scan time column shows the current time, and the action button becomes the static text "Done" — all without a page reload.
**Why human:** Fetch response handling and in-place DOM mutation require a browser with live API and DB row.

### 7. Double-Tap Protection

**Test:** Click "Check In" rapidly twice in quick succession (or simulate slow network with DevTools).
**Expected:** Button becomes visually disabled (opacity 0.5, cursor not-allowed) immediately after the first click. A second click before the fetch completes has no effect.
**Why human:** Button disabled state during an in-flight fetch requires browser and network timing to observe.

### Gaps Summary

No automated gaps found. All 14 must-haves verified against the codebase. The 7 human verification items above cannot be confirmed without a running server and browser — they are behavioral confirmations of correctly wired code, not evidence of missing implementation.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
