---
phase: 02-square-integration
plan: 04
subsystem: payments
tags: [express, ejs, knex, sqlite, polling]

# Dependency graph
requires:
  - phase: 02-square-integration
    plan: 01
    provides: "tickets table with uuid, status, square_order_id columns; ticketsRouter mounted at /"
  - phase: 02-square-integration
    plan: 03
    provides: "webhook handler sets ticket status to confirmed via square_order_id correlation"
provides:
  - "GET /ticket/pending — validates uuid, guards unknown tickets, renders pending.ejs"
  - "GET /api/ticket-status — JSON { status } polling endpoint (400 missing, 404 unknown)"
  - "pending.ejs — polling page with 2s interval, 30s timeout, 3-retry network error handling, CSS animated ellipsis"
affects: [03-confirmation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express 5 async route handlers with no try/catch — async errors auto-forwarded to global handler"
    - "Knex select('status').where({ uuid }).first() — returns only status field, no buyer PII (T-02-13)"
    - "Client-side polling via async/await fetch with setTimeout recursion — no setInterval to avoid drift"
    - "CSS @keyframes blink for animated ellipsis — no JS animation library"

key-files:
  created:
    - "ticketing/src/views/pending.ejs — polling holding page with timeout state and CSS ellipsis animation"
  modified:
    - "ticketing/src/routes/tickets.js — expanded from TODO stub; GET /ticket/pending and GET /api/ticket-status"

key-decisions:
  - "GET /ticket/pending does NOT set status to confirmed — status is exclusively set by the webhook handler (T-02-14 mitigation)"
  - "GET /api/ticket-status returns only { status }, no buyer name or email (T-02-13 — uuid entropy makes enumeration infeasible)"
  - "Network error retry logic: up to 3 retries before triggering timeout state, matching spec exactly"
  - "Polling uses setTimeout recursion (not setInterval) to prevent overlapping requests on slow networks"

requirements-completed: [PURCH-01, PURCH-03]

# Metrics
duration: 1min
completed: 2026-05-14
---

# Phase 2 Plan 04: Pending Page and Ticket Status API Summary

**GET /ticket/pending and GET /api/ticket-status routes with pending.ejs polling page — closes the Phase 2 buyer journey from Square redirect to webhook confirmation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-14T17:13:53Z
- **Completed:** 2026-05-14T17:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Expanded `ticketing/src/routes/tickets.js` from a 7-line TODO stub to a complete route file with two handlers
- GET /ticket/pending: validates uuid query param, redirects to / if missing, redirects to / if ticket not found in DB, renders pending.ejs with uuid — explicitly does not set status to confirmed (T-02-14 mitigation)
- GET /api/ticket-status: returns JSON { status } for known uuid, 400 for missing uuid, 404 for unknown uuid — returns only status field, no buyer PII (T-02-13)
- Created `ticketing/src/views/pending.ejs` implementing full spec from 02-UI-SPEC.md Page 2
- Polling script polls every 2s, times out after 30s, handles up to 3 network errors before showing timeout state
- Timeout state shows "Taking longer than expected" heading in neon-yellow and full body copy matching copywriting contract
- Animated ellipsis via CSS @keyframes blink only — no JS animation library
- uuid interpolated with `<%= uuid %>` (auto-escaped) per EJS safety pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement GET /ticket/pending and GET /api/ticket-status routes in tickets.js** - `e00679c` (feat)
2. **Task 2: Create pending.ejs polling page** - `2378c6d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `ticketing/src/routes/tickets.js` — expanded from TODO stub; both route handlers implemented
- `ticketing/src/views/pending.ejs` — new file; polling page with neon aesthetic, timeout state, CSS animated ellipsis

## Decisions Made

- GET /ticket/pending does not write to the tickets table — status is set exclusively by the webhook handler. This is T-02-14 mitigation (tampering via redirect URL).
- GET /api/ticket-status returns only `{ status }` — no buyer name, email, or payment data. UUID v4 entropy (122 bits) makes enumeration infeasible (T-02-13 accepted risk).
- Polling uses setTimeout recursion rather than setInterval to prevent overlapping requests when the API is slow to respond.
- Network errors reset after a successful response (`networkErrors = 0`), so transient errors during a long wait do not accumulate toward the 3-retry limit.

## Deviations from Plan

None — plan executed exactly as written. All patterns followed 02-PATTERNS.md and 02-UI-SPEC.md specifications.

## Known Stubs

None. Both files are fully implemented:
- `tickets.js` routes are complete and tested (module load passes)
- `pending.ejs` polling page is complete; the redirect target `/ticket/:uuid` is a known pending Phase 3 deliverable, not a stub in this plan

## Threat Flags

None — all threat model mitigations in this plan's threat register are implemented:
- T-02-13 (Information Disclosure — uuid enumeration): GET /api/ticket-status returns only { status }, no PII
- T-02-14 (Tampering — status spoofing via redirect URL): GET /ticket/pending does not write to tickets table
- T-02-15 (Tampering — XSS via uuid in JS): `<%= uuid %>` used (not `<%-`), auto-escape provides defense in depth

## Self-Check: PASSED

- `ticketing/src/routes/tickets.js` exists: FOUND
- `ticketing/src/views/pending.ejs` exists: FOUND
- Commit `e00679c` exists: FOUND (Task 1)
- Commit `2378c6d` exists: FOUND (Task 2)
- No unexpected file deletions: CONFIRMED
- tickets router loads (node -e require): PASSED
- pending.ejs contains api/ticket-status: CONFIRMED
- pending.ejs contains "Taking longer than expected": CONFIRMED

---
*Phase: 02-square-integration*
*Completed: 2026-05-14*
