---
phase: 02-square-integration
plan: 01
subsystem: payments
tags: [square, express, ejs, knex, sqlite, migrations]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Express app with Knex DB, tickets/events/processed_webhook_events tables, stub route files"
provides:
  - "Square SDK singleton (SquareClient) loaded from SQUARE_ACCESS_TOKEN env var"
  - "Phase 2 schema migration: status and square_order_id columns on tickets table"
  - "GET / event page with live confirmed-count capacity badge and buy form"
  - "POST /checkout placeholder that validates input, creates pending ticket, calls Square API, redirects"
  - "Raw-body capture middleware for Square webhook HMAC verification (SEC-01)"
  - "Three routers mounted in correct order: webhooks, events, tickets"
affects: [02-02, 02-03, 02-04, 03-confirmation, 04-scanner, 05-admin]

# Tech tracking
tech-stack:
  added: ["square@^44.0.1 (official Square SDK — SquareClient, SquareEnvironment, WebhooksHelper)"]
  patterns:
    - "SquareClient singleton in src/lib/square.js — instantiated once per process, imported by route files"
    - "express.json({ verify }) for raw-body capture — all routes get req.rawBody; only webhooks.js uses it"
    - "Capacity bucket logic using ratio-based thresholds (Available/Limited/A Few Left/Almost Gone/Sold Out)"
    - "Express 5 async route handlers with no try/catch except Square API call (Pitfall 6 cleanup)"
    - "Two-step ticket creation: INSERT pending row first, UPDATE square_order_id after payment link success"

key-files:
  created:
    - "ticketing/src/lib/square.js — SquareClient singleton, loaded from SQUARE_ACCESS_TOKEN"
    - "ticketing/src/db/migrations/20260514_002_tickets_status.js — adds status + square_order_id to tickets"
    - "ticketing/src/views/event.ejs — concert poster layout with capacity badge and buy form"
  modified:
    - "ticketing/index.js — raw-body verify callback on express.json(), three router mounts"
    - "ticketing/src/routes/events.js — GET / and POST /checkout implemented"
    - "ticketing/.env.example — Phase 2 env vars appended (SQUARE_ACCESS_TOKEN, etc.)"
    - "ticketing/package.json — square dependency added"

key-decisions:
  - "Use order_id (not reference_id) for webhook correlation — reference_id is unreliable in Square sandbox and production (D-07 revision from RESEARCH.md)"
  - "Capacity bucket thresholds use ratio-based math (not fixed seat counts) so they scale if capacity changes"
  - "express.json({ verify }) raw-body approach chosen over route-level express.raw() — cleaner, no route ordering conflicts"
  - "Two-step ticket write (INSERT pending, then UPDATE square_order_id) is intentional — UUID needed for redirect URL before Square order_id is known"

patterns-established:
  - "Square singleton: require('../lib/square') from any route file — never re-instantiate"
  - "Capacity query: always filter status='confirmed', always parseInt() the result (SQLite returns string)"
  - "EJS auto-escape: always <%= %> for all DB-sourced and user-supplied variables, never <%- %>"
  - "Route mounting order: /webhooks before / in index.js to prevent shadowing"

requirements-completed: [PURCH-01, PURCH-02]

# Metrics
duration: 6min
completed: 2026-05-14
---

# Phase 2 Plan 01: Square SDK, Schema Migration, and Event Page Summary

**Square SDK singleton wired with raw-body middleware, Phase 2 Knex migration (status + square_order_id on tickets), and concert poster event page with live capacity badge and buy form**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-14T16:55:26Z
- **Completed:** 2026-05-14T17:01:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed square@^44.0.1 SDK; created SquareClient singleton (src/lib/square.js) that selects Sandbox vs Production environment from NODE_ENV
- Applied Phase 2 Knex migration adding status (non-null, default 'confirmed') and square_order_id (nullable) columns to the tickets table — confirmed via columnInfo() check after migration run
- Built GET / in events.js querying confirmed ticket count, deriving bucket capacity label, and rendering full event.ejs concert poster with live capacity badge
- Built POST /checkout in events.js with input validation, capacity pre-check, pending ticket creation, Square payment link creation, and order_id storage
- Created event.ejs concert poster layout matching Powder Rhythm aesthetic: Permanent Marker headline, Fredoka One date/venue/price, Boogaloo capacity badge with neon color per bucket, buy form with sold-out disabled state
- Wired express.json({ verify }) raw-body capture in index.js for future HMAC verification (SEC-01); mounted webhooks, events, tickets routers in correct order

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Square SDK, create lib/square.js singleton, update .env.example and index.js** - `c31291e` (feat)
2. **Task 2: Phase 2 migration, events.js route with capacity logic, event.ejs concert poster** - `fe5c4c7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `ticketing/src/lib/square.js` - SquareClient singleton, exports single instance using SQUARE_ACCESS_TOKEN
- `ticketing/src/db/migrations/20260514_002_tickets_status.js` - alterTable migration adding status and square_order_id to tickets
- `ticketing/src/views/event.ejs` - Concert poster layout with capacity badge, buy form, sold-out state, Powder Rhythm neon aesthetic
- `ticketing/src/routes/events.js` - GET / (event page render) and POST /checkout (pending ticket + Square payment link)
- `ticketing/index.js` - express.json() replaced with verify callback, three routers mounted in order
- `ticketing/.env.example` - Appended SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_WEBHOOK_URL, APP_URL
- `ticketing/package.json` + `package-lock.json` - square dependency added

## Decisions Made

- Used order_id correlation strategy for webhooks (not reference_id), per D-07 revision in RESEARCH.md. reference_id is absent from payment.updated payloads in Square sandbox.
- Capacity thresholds are ratio-based (confirmedCount / event.capacity) rather than fixed seat counts, so they scale correctly when capacity is updated before the launch event.
- Raw-body approach uses express.json({ verify }) rather than a separate express.raw() middleware to avoid route ordering conflicts.

## Deviations from Plan

None - plan executed exactly as written. All patterns followed RESEARCH.md and PATTERNS.md specifications.

## Issues Encountered

The worktree was initially branched from an old commit that predated the ticketing directory (commit e3ca940). After discovering the worktree lacked the ticketing/ directory, a `git reset --hard main` brought the worktree up to the current main state (285644a) before executing. This is normal worktree initialization behavior and was resolved before any task work began.

## User Setup Required

**External services require manual configuration before Phase 2 checkout flow can be tested end-to-end:**

- `SQUARE_ACCESS_TOKEN` — Obtain from Square Developer Dashboard, Applications, Sandbox credentials
- `SQUARE_LOCATION_ID` — From Square Developer Dashboard, Locations tab
- `SQUARE_WEBHOOK_SIGNATURE_KEY` — From Square Developer Dashboard, Webhooks subscription (after Phase 2 Plan 02 deploys webhook route)
- `SQUARE_WEBHOOK_URL` — Register after deployment; must match Railway URL byte-for-byte
- `APP_URL` — Set to `http://localhost:3000` for dev, `https://tickets.powderrhythm.com` for prod

Copy `.env.example` to `.env` and fill in real values before testing.

## Next Phase Readiness

Plan 02 (webhooks, ticket confirmation, pending page) can proceed. The migration is applied, the Square singleton is available, and the event page is live. What remains for the full purchase flow:
- `POST /webhooks/square` — HMAC verification, idempotency, ticket confirmation (Plan 02)
- `GET /ticket/pending` and `GET /api/ticket-status` — polling holding page (Plan 02)
- `GET /ticket/:uuid` — confirmation page with QR code (Phase 3)

Known open questions from RESEARCH.md still apply:
- Whether `buyer_email_address` appears in payment.updated webhook payloads in sandbox (log full body to confirm)
- Whether the redirect URL sandbox behavior affects the polling flow (expect it does not — webhook is source of truth)

---
*Phase: 02-square-integration*
*Completed: 2026-05-14*
