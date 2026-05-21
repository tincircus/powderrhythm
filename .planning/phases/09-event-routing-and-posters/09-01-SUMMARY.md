---
phase: 09-event-routing-and-posters
plan: "01"
subsystem: ticketing
tags: [routing, events, express, tdd]
dependency_graph:
  requires: []
  provides: [GET /events/:id, POST /events/:id/checkout, root redirect]
  affects: [ticketing/index.js, ticketing/src/routes/events.js, ticketing/src/views/event.ejs]
tech_stack:
  added: []
  patterns: [parameterized Express routes, 404 guard with parseInt+isNaN, TDD with Node built-in test runner]
key_files:
  created:
    - ticketing/test/events-router.test.js
  modified:
    - ticketing/src/routes/events.js
    - ticketing/src/views/event.ejs
    - ticketing/index.js
decisions:
  - "Event ID validated with parseInt+isNaN before any DB query (T-09-01 mitigation)"
  - "Root redirect uses HTTP 302 (temporary) to /events/1 — preserves flexibility for multi-event future"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-21"
  tasks_completed: 3
  files_modified: 4
---

# Phase 09 Plan 01: Event Routing Refactor Summary

Parameterized Express routes so `GET /events/:id` and `POST /events/:id/checkout` replace the old root-mounted `/` and `/checkout` routes. The ticket URL `https://tickets.powderrhythm.com/events/1` now resolves to the event page and the checkout form submits to `/events/1/checkout`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for /events/:id routes | 2e9ad0c | ticketing/test/events-router.test.js |
| 1 (GREEN) | Refactor events.js to parameterized routes | c81db67 | ticketing/src/routes/events.js |
| 2 | Update form action in event.ejs | 4a0fef2 | ticketing/src/views/event.ejs |
| 3 | Remount events router at /events + root redirect | eaaf209 | ticketing/index.js |

## Verification Results

- Route paths check: `routes: [ '/:id', '/:id/checkout' ]` — PASS
- event.ejs form action grep: `1` match for `/events/<%= event.id %>/checkout` — PASS
- index.js grep: both `app.use('/events'` and `res.redirect(302, '/events/1')` present — PASS
- 11/11 events router tests pass (TDD GREEN)
- 12/12 scan-api tests still pass (unaffected)

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: commit `2e9ad0c` — `test(09-01): add failing tests for parameterized /events/:id routes`
- GREEN gate: commit `c81db67` — `feat(09-01): refactor events.js to parameterized /events/:id routes`

## Threat Surface Scan

No new network endpoints or trust boundaries introduced. The non-numeric/NaN guard on `:id` (T-09-01 mitigation) is implemented in both GET and POST handlers.

## Known Stubs

None.

## Self-Check: PASSED

- ticketing/src/routes/events.js: exists, routes `/:id` and `/:id/checkout` confirmed
- ticketing/src/views/event.ejs: form action `/events/<%= event.id %>/checkout` confirmed
- ticketing/index.js: `app.use('/events', eventsRouter)` and root redirect confirmed
- ticketing/test/events-router.test.js: created, 11/11 tests passing
- Commits 2e9ad0c, c81db67, 4a0fef2, eaaf209: all present in git log
