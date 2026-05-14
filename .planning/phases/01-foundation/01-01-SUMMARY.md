---
phase: 01-foundation
plan: 01
subsystem: database
tags: [knex, sqlite, postgres, express, railway, better-sqlite3]

# Dependency graph
requires: []
provides:
  - ticketing/ project scaffold with package.json, .gitignore, .env.example, railway.toml
  - src/db/knex.js dual-client Knex singleton (SQLite dev / Postgres prod)
  - Full schema migration (events, tickets, processed_webhook_events) with seed event row
  - Stub route and middleware files for Phases 2-5
affects: [01-02, 02-payments, 03-ticketing, 04-scanner, 05-admin, 06-production]

# Tech tracking
tech-stack:
  added: [express@5.2.1, knex@3.2.10, better-sqlite3@12.10.0, pg@8.20.0, ejs@5.0.2, dotenv@17.4.2, nodemon@3.1.14]
  patterns:
    - "Dual-client Knex factory: DATABASE_URL present -> pg, absent -> better-sqlite3"
    - "SQLite path via path.join(__dirname, '..', '..', 'dev.sqlite') — absolute, not relative"
    - "Startup migration pattern: knex.migrate.latest() before app.listen()"
    - "Single Knex instance exported from src/db/knex.js — never re-instantiate in routes"

key-files:
  created:
    - ticketing/package.json
    - ticketing/.gitignore
    - ticketing/.env.example
    - ticketing/railway.toml
    - ticketing/package-lock.json
    - ticketing/src/db/knex.js
    - ticketing/src/db/migrations/20260514_001_initial_schema.js
    - ticketing/src/middleware/auth.js
    - ticketing/src/routes/events.js
    - ticketing/src/routes/tickets.js
    - ticketing/src/routes/webhooks.js
    - ticketing/src/routes/scan.js
    - ticketing/src/routes/admin.js
    - ticketing/src/views/.gitkeep
  modified: []

key-decisions:
  - "D-01: Knex.js for both migrations and query building — single src/db/knex.js singleton"
  - "D-02: Client selection via DATABASE_URL env var — pg for prod, better-sqlite3 for dev"
  - "D-06: scanned_at TIMESTAMP NULL only — no boolean column; NULL means unscanned"
  - "D-07: UUIDs generated app-side via crypto.randomUUID() — column just stores the value"
  - "D-09: square_event_id UNIQUE for webhook idempotency"
  - "D-10/D-11: Seed event with PLACEHOLDER price_cents/capacity — TODO comment required"
  - "ssl: { rejectUnauthorized: false } in pg branch — required for Railway self-signed cert"
  - "No knexfile.js — migrations config embedded in src/db/knex.js, run programmatically at startup"

patterns-established:
  - "Pattern: const db = require('../db/knex') — all routes import from this singleton"
  - "Pattern: path.join(__dirname, ...) for all SQLite file paths"
  - "Pattern: exports.up / exports.down async functions for Knex migrations"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 01 Plan 01: Ticketing Project Scaffold and Knex Database Module Summary

**Knex dual-client SQLite/Postgres factory with full 3-table schema migration, seed event row, and Express project scaffold for Railway deployment**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-14T15:15:40Z
- **Completed:** 2026-05-14T15:17:50Z
- **Tasks:** 2
- **Files modified:** 14 (all created)

## Accomplishments
- ticketing/ npm project with exact pinned dependencies, engines node>=20, start/dev scripts
- src/db/knex.js: dual-client Knex singleton — selects pg (Railway Postgres) or better-sqlite3 (local dev) based on DATABASE_URL env var
- Full schema migration defining events, tickets, processed_webhook_events tables with correct column specs (D-06 through D-09)
- Seed event "Powder Rhythm Launch" (May 29) with placeholder price/capacity and required TODO comment (D-10, D-11)
- railway.toml with healthcheckPath enabling zero-downtime Railway deploys
- Stub route and middleware files providing directory structure for Phases 2-5

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ticketing/ project scaffold and install dependencies** - `15a31cd` (chore)
2. **Task 2: Create Knex dual-client factory and full schema migration** - `65d6427` (feat)

## Files Created/Modified
- `ticketing/package.json` - npm manifest with exact pinned deps, engines node>=20, start/dev scripts
- `ticketing/.gitignore` - excludes node_modules/, dev.sqlite, .env
- `ticketing/.env.example` - PORT, DATABASE_URL (commented), ADMIN_PASSWORD (commented) templates
- `ticketing/railway.toml` - healthcheckPath=/health, healthcheckTimeout=30
- `ticketing/package-lock.json` - lockfile (162 packages, 0 vulnerabilities)
- `ticketing/src/db/knex.js` - dual-client Knex singleton with SSL config for Railway Postgres
- `ticketing/src/db/migrations/20260514_001_initial_schema.js` - events, tickets, processed_webhook_events tables + seed event with guard
- `ticketing/src/middleware/auth.js` - stub (Phase 2)
- `ticketing/src/routes/events.js` - stub (Phase 2)
- `ticketing/src/routes/tickets.js` - stub (Phase 2+)
- `ticketing/src/routes/webhooks.js` - stub (Phase 2)
- `ticketing/src/routes/scan.js` - stub (Phase 4)
- `ticketing/src/routes/admin.js` - stub (Phase 5)
- `ticketing/src/views/.gitkeep` - directory tracker

## Decisions Made
- Used `path.join(__dirname, '..', '..', 'dev.sqlite')` for absolute SQLite path (avoids Pitfall 1 — CWD-relative path would land dev.sqlite in the wrong directory)
- `ssl: { rejectUnauthorized: false }` in pg branch (required for Railway's self-signed cert, per Pitfall 2)
- No `knexfile.js` — migration config lives in knex.js, run programmatically at startup (avoids Pitfall 3 — CLI vs runtime config mismatch)
- Single migration file for all 3 tables (tables always deployed together in Phase 1; no prior migration history)
- `useNullAsDefault: true` in SQLite branch (suppresses Knex INSERT warnings for nullable columns)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

These stubs are intentional per the plan — they establish the directory structure for future phases:

| File | Stub | Reason |
|------|------|--------|
| `ticketing/src/routes/events.js` | Empty Express router | Phase 2 implementation |
| `ticketing/src/routes/tickets.js` | Empty Express router | Phase 2+ implementation |
| `ticketing/src/routes/webhooks.js` | Empty Express router | Phase 2 implementation |
| `ticketing/src/routes/scan.js` | Empty Express router | Phase 4 implementation |
| `ticketing/src/routes/admin.js` | Empty Express router | Phase 5 implementation |
| `ticketing/src/middleware/auth.js` | Pass-through next() | Phase 2 implementation |
| `src/db/migrations/...` | price_cents: 2000, capacity: 50 | PLACEHOLDER per D-11 — update before Phase 6 production deploy |

## Issues Encountered
None

## Knex Instance Export Contract

Downstream plans import the Knex instance from `src/db/knex.js`:
```javascript
const db = require('../db/knex'); // single import, never re-instantiate
```

The exported `db` object is a fully configured Knex instance with:
- `.migrate.latest()` — runs pending migration files from `src/db/migrations/`
- `.raw(sql)` — for health check and raw queries
- `db('table_name')` — query builder for all CRUD operations
- `.destroy()` — graceful connection pool shutdown

## Verification Results (Smoke Tests)

All 7 smoke tests from the plan passed:

1. `node -e "require('./src/db/knex')"` — exits 0
2. `grep "dev.sqlite" .gitignore` — returns `dev.sqlite`
3. `grep "^\.env$" .gitignore` — returns `.env`
4. `grep "exports.up" migration.js` — returns the line
5. `grep "rejectUnauthorized" src/db/knex.js` — returns the line with `false`
6. Standalone "scanned" column count — 0 (only scanned_at present)
7. `grep "TODO: Update price_cents" migration.js` — returns the TODO comment line

## User Setup Required

None - no external service configuration required for this plan. The ticketing/ directory is ready for Phase 01-02 (Express server with health check route).

## Next Phase Readiness
- Phase 01-02 can now create `ticketing/index.js` and the health check route — all dependencies (Knex instance, migration, package.json) are in place
- `node -e "require('./src/db/knex')"` exits 0 from the ticketing/ directory
- npm dependencies installed (162 packages)
- dev.sqlite is gitignored before any git add operations on ticketing/

---
*Phase: 01-foundation*
*Completed: 2026-05-14*
