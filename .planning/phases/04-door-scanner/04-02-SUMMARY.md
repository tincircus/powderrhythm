---
phase: 04-door-scanner
plan: 02
subsystem: ticketing/scan-api
tags: [scan, api, atomic-update, knex, auth, tdd]
dependency_graph:
  requires:
    - 04-01-PLAN.md (makeAuthMiddleware, makeToken, compareStrings, COOKIE_NAME, UUID_RE, db)
  provides:
    - POST /api/scan (atomic ticket check-in, SEC-03)
    - GET /api/scan/search (name/email lookup fallback, D-06)
  affects:
    - ticketing/src/routes/scan.js (both endpoints added to existing router)
tech_stack:
  added:
    - node:test (Node.js built-in test runner, no new packages)
  patterns:
    - Atomic UPDATE WHERE scanned_at IS NULL (SEC-03, T-4-07)
    - rows-affected integer check (no .returning() — cross-DB safe)
    - Inline 401 JSON auth check (fetch()-compatible, not redirect)
    - whereILike for case-insensitive LIKE on both SQLite and Postgres
    - whereRaw fallback for older Knex compatibility
key_files:
  created:
    - ticketing/test/scan-api.test.js
  modified:
    - ticketing/src/routes/scan.js
    - ticketing/package-lock.json
decisions:
  - Inline auth check (not requireScanAuth middleware) on both API endpoints so browser fetch() receives parseable 401 JSON, not an HTML redirect
  - No .returning() on atomic UPDATE — preserves integer rows-affected for both SQLite and Postgres (Pitfall 6)
  - whereILike with whereRaw fallback for cross-DB case-insensitive search
  - node:test built-in runner chosen to avoid new package install (no package legitimacy concern)
metrics:
  duration: "~180s"
  completed: "2026-05-21T03:36:00Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 4 Plan 02: Atomic Scan Endpoint and Search Fallback Summary

Atomic POST /api/scan with UPDATE WHERE scanned_at IS NULL (SEC-03) plus auth-gated GET /api/scan/search with case-insensitive name/email LIKE query.

## What Was Built

**Task 1 (TDD) — POST /api/scan atomic endpoint:**
- Inline auth check returns 401 JSON (not redirect) so browser `fetch()` can parse the error
- UUID validation via UUID_RE — 400 `{ error: 'Invalid uuid' }` on missing or malformed input
- Atomic `db('tickets').where({ uuid }).whereNull('scanned_at').update({ scanned_at: db.fn.now() })` — no `.returning()` chained
- `rowsAffected === 1`: fetch buyer_name, return `{ ok: true, name }` (no email — T-4-09)
- `rowsAffected === 0` + ticket exists: return `{ ok: false, reason: 'already_scanned', scannedAt }`
- `rowsAffected === 0` + no ticket: return `{ ok: false, reason: 'not_found' }`
- Full try/catch: 500 JSON on unexpected errors

**Task 2 — GET /api/scan/search:**
- Same inline auth check as Task 1
- Empty/whitespace-only `q` returns `[]` immediately (no DB round-trip)
- `whereILike('buyer_name', '%term%').orWhereILike('buyer_email', '%term%')` — case-insensitive for both SQLite and Postgres
- `whereRaw` fallback for older Knex without `whereILike`
- `.limit(20)` prevents large payloads on broad queries
- Returns `[{ uuid, buyer_name, buyer_email, scanned_at }]` — only confirmed tickets

**TDD cycle:**
- RED: 11 failing tests committed (349b5e7) using `node:test` built-in runner
- GREEN: Implementation committed (aa29b94) — all 11 tests pass

## Verification Results

All 7 plan smoke tests passed against running server (ADMIN_PASSWORD=testpass, dev.sqlite with confirmed ticket):

| Test | Description | Result |
|------|-------------|--------|
| 04-02-01 | Valid ticket first scan returns `ok:true` | PASS |
| 04-02-02 | Same ticket second scan returns `already_scanned` | PASS |
| 04-02-03 | Unknown UUID returns `not_found` | PASS |
| 04-02-04 | No cookie returns 401 JSON (not HTML) | PASS |
| 04-02-05 | Invalid UUID returns 400 `Invalid uuid` | PASS |
| 04-02-06 | Search without cookie returns 401 | PASS |
| 04-02-07 | Search with empty query returns `[]` | PASS |

Automated acceptance criteria:
- `whereNull('scanned_at')` present in code — PASS
- `rowsAffected` check present — PASS
- No `.returning()` in executable code (comment only) — PASS
- Module loads without error — PASS
- 11/11 unit tests pass — PASS

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 RED: failing tests | 349b5e7 | ticketing/test/scan-api.test.js |
| Task 1+2 GREEN: implementation | aa29b94 | ticketing/src/routes/scan.js |
| Package-lock pin update | 6c75bb1 | ticketing/package-lock.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Install node_modules in worktree before running tests**
- **Found during:** RED phase setup
- **Issue:** Worktree `ticketing/` had no `node_modules/` — `npm install` had not been run in the worktree. Tests could not load `express` or other dependencies.
- **Fix:** Ran `npm install --prefer-offline` in the worktree's `ticketing/` directory. This only installs packages already in `package.json` / `package-lock.json` — no new packages added.
- **Files modified:** ticketing/node_modules/ (not committed), ticketing/package-lock.json (exact pin update committed as 6c75bb1)
- **Commit:** 6c75bb1

**2. [Rule 2 - Missing critical functionality] whereRaw fallback for older Knex**
- **Found during:** Task 2 implementation
- **Issue:** `whereILike` was added in Knex 0.95.4. While the project uses Knex 3.2.10, the plan explicitly noted a fallback pattern. Added try/catch around the `whereILike` query with a `whereRaw` fallback as the plan specified.
- **Fix:** Wrapped `whereILike` in try/catch; fallback uses `whereRaw('LOWER(buyer_name) LIKE ?', ...)` — parameterized, no SQL injection risk.
- **Files modified:** ticketing/src/routes/scan.js

## Known Stubs

None. Both endpoints are fully implemented and verified.

## Threat Surface Scan

All T-4-07 through T-4-11 mitigations are implemented:
- T-4-07: Atomic UPDATE WHERE scanned_at IS NULL — exactly one caller gets `rowsAffected === 1`
- T-4-08: Inline 401 JSON check before any DB access — no auth bypass path
- T-4-09: buyer_name returned from POST /api/scan, buyer_email is NOT returned
- T-4-10: Search is auth-gated; UUID enumeration accepted risk (rate limiting deferred Phase 6)
- T-4-11: `whereILike` / `whereRaw` with `?` placeholder — parameterized, no injection

## TDD Gate Compliance

- RED gate commit present: 349b5e7 (`test(04-02): add failing tests...`)
- GREEN gate commit present: aa29b94 (`feat(04-02): add POST /api/scan...`)
- All 11 tests confirmed failing before implementation, all 11 passing after

## Self-Check: PASSED

Files verified present:
- ticketing/src/routes/scan.js — exists, contains whereNull, rowsAffected, /api/scan/search, limit(20)
- ticketing/test/scan-api.test.js — exists, 11 test cases

Commits verified present:
- 349b5e7 — test(04-02): RED gate
- aa29b94 — feat(04-02): GREEN gate
- 6c75bb1 — chore(04-02): package-lock
