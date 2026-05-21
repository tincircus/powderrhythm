---
phase: 05-admin-panel
plan: 01
subsystem: ticketing/admin
tags: [auth, admin, ejs, middleware, express]
dependency_graph:
  requires: [phase-04-door-scanner]
  provides: [admin-password-gate, attendee-list, headcount-banner, check-in-endpoint]
  affects: [ticketing/src/middleware/auth.js, ticketing/src/routes/admin.js, ticketing/index.js]
tech_stack:
  added: []
  patterns: [makeAuthMiddleware-factory, inline-auth-json-api, atomic-update-checkin, ejs-server-render]
key_files:
  created:
    - ticketing/src/routes/admin.js
    - ticketing/src/views/admin-login.ejs
    - ticketing/src/views/admin.ejs
  modified:
    - ticketing/src/middleware/auth.js
    - ticketing/index.js
decisions:
  - "Use buyer_email column name (matches DB schema from migration 001)"
  - "POST /api/admin/checkin/:uuid implemented in plan 01 (not deferred to plan 02) — plan spec included it in admin.js"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_modified: 5
---

# Phase 05 Plan 01: Admin Panel Foundation Summary

Password-gated admin panel with attendee table, live headcount, and manual check-in endpoint using extended auth middleware factory.

## What Was Built

### Task 1: Extend makeAuthMiddleware (commit 7b77c28)

Extended `makeAuthMiddleware(cookieName)` in `auth.js` to accept a second `loginPath` parameter defaulting to `'/scan/login'`. The hardcoded redirect on line 43 is replaced with the `loginPath` variable. Single-argument calls in `scan.js` continue to redirect to `/scan/login` unchanged.

### Task 2: Implement admin.js routes (commit f604d1e)

Full implementation of `ticketing/src/routes/admin.js`:
- `GET /admin/login` renders `admin-login` view with `{ error: null }`
- `POST /admin/login` validates password with `compareStrings` (timing-safe), sets `admin_auth` httpOnly cookie via `makeToken`, redirects to `/admin`
- `GET /admin` auth-gated via `requireAdminAuth = makeAuthMiddleware('admin_auth', '/admin/login')`, queries confirmed tickets ordered by name, computes `checkedIn` and `totalSold` server-side
- `POST /api/admin/checkin/:uuid` inline auth-gated (JSON 401 on failure), atomic `UPDATE WHERE scanned_at IS NULL`, returns 200/409/404

### Task 3: EJS views + router mount (commit 2813a7d)

- `admin-login.ejs`: verbatim copy of `scan-login.ejs` with 4 substitutions (title, h1, form action, button text)
- `admin.ejs`: full attendee table with headcount banner, search input (with `<label>`), `data-name` on each `<tr>` for client-side filtering, `data-uuid` on check-in buttons, empty state for zero attendees
- `ticketing/index.js`: `app.use('/', require('./src/routes/admin'))` added after scan router mount

## Verification Results

All success criteria confirmed:

| Check | Expected | Result |
|-------|----------|--------|
| GET /admin (no cookie) | 302 -> /admin/login | PASS |
| GET /admin/login | 200 | PASS |
| POST /admin/login (wrong password) | 200 + error message | PASS |
| POST /admin/login (correct password) | 302 -> /admin | PASS |
| GET /admin (valid cookie) | 200 + attendee table HTML | PASS |
| GET /scan (no cookie) | 302 -> /scan/login | PASS |
| makeAuthMiddleware('scan_auth') default | /scan/login | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong column name email -> buyer_email**
- **Found during:** Task 3 verification
- **Issue:** `admin.js` query used `.select('uuid', 'buyer_name', 'email', 'scanned_at')` but the DB schema defines the column as `buyer_email` (migration 20260514_001_initial_schema.js line 21)
- **Fix:** Changed column name to `buyer_email` in both `admin.js` query and `admin.ejs` template
- **Files modified:** `ticketing/src/routes/admin.js`, `ticketing/src/views/admin.ejs`
- **Commit:** 2813a7d (included in Task 3 commit)

### Scope Expansion (within plan)

**POST /api/admin/checkin/:uuid included in plan 01** — The plan action spec for Task 2 listed this endpoint as "added in Plan 02" in a comment but the full route implementation was requested in the `<action>` block. Implemented it fully in plan 01 as specified.

## Known Stubs

**admin.ejs client-side JS:** The `<!-- JS: search + check-in interaction added in Plan 02 -->` comment marks where plan 02 will wire the search filter and fetch-based check-in behavior. The server-rendered table, `data-name` attributes, and `data-uuid` buttons are all present — the JS interaction layer is intentionally deferred to plan 02.

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat register. All T-05-01 through T-05-04 mitigations implemented as specified:
- T-05-01: `compareStrings` uses `timingSafeEqual` (reused from auth.js)
- T-05-02: Cookie value is HMAC-SHA256 of `ADMIN_PASSWORD`
- T-05-03: `requireAdminAuth` gates `GET /admin` before any DB query
- T-05-04: Separate cookie name `admin_auth` vs `scan_auth`; `makeAuthMiddleware` checks `req.cookies[cookieName]`

## Self-Check: PASSED

Files exist:
- ticketing/src/middleware/auth.js: FOUND
- ticketing/src/routes/admin.js: FOUND
- ticketing/src/views/admin-login.ejs: FOUND
- ticketing/src/views/admin.ejs: FOUND
- ticketing/index.js: FOUND

Commits exist:
- 7b77c28 (Task 1 — extend makeAuthMiddleware): FOUND
- f604d1e (Task 2 — admin routes): FOUND
- 2813a7d (Task 3 — views + router mount): FOUND
