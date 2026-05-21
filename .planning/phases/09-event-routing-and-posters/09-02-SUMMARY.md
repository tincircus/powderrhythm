---
phase: 09-event-routing-and-posters
plan: "02"
subsystem: ticketing
tags: [static-assets, express, poster, image, event-page]
dependency_graph:
  requires: ["09-01"]
  provides: [GET /posters/event-1.jpg, poster img in event.ejs, posters/event-1.jpg at repo root]
  affects: [ticketing/index.js, ticketing/src/views/event.ejs, ticketing/public/posters/, posters/]
tech_stack:
  added: []
  patterns: [express.static for public/ directory, onerror handler for graceful poster fallback]
key_files:
  created:
    - ticketing/public/posters/event-1.jpg
    - posters/event-1.jpg
  modified:
    - ticketing/index.js
    - ticketing/src/views/event.ejs
decisions:
  - "express.static mounted before webhooks router to ensure static files are served before route handlers"
  - "Poster filename convention event-{event.id}.jpg derived from DB event ID — no schema change needed"
  - "onerror handler hides img gracefully when poster file is absent — non-blocking for future events"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-21"
  tasks_completed: 4
  files_modified: 4
---

# Phase 09 Plan 02: Poster Assets and Static Serving Summary

Express static middleware added to ticketing server; show poster image (440K JPEG) copied to both Railway and Netlify deployment paths; `event.ejs` now renders a responsive poster image above the event title with a neon-pink box-shadow and onerror fallback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add express.static middleware in ticketing/index.js | 440efe8 | ticketing/index.js |
| 2 | Create poster directories and copy image to both destinations | fa32d8e | ticketing/public/posters/event-1.jpg, posters/event-1.jpg |
| 3 | Add poster img and CSS to event.ejs | 13cdf96 | ticketing/src/views/event.ejs |
| 4 | Integration smoke test — poster served from ticketing server | (no commit — verification only) | — |

## Verification Results

- `GET /posters/event-1.jpg` from ticketing server: 200 — PASS
- `GET /posters/nonexistent.jpg` from ticketing server: 404 — PASS
- `poster-img` occurrences in rendered HTML from `/events/1`: 2 (CSS + img tag) — PASS
- `onerror` handler in rendered HTML: 1 — PASS
- `posters/event-1.jpg` at repo root: 440K, matches source — PASS
- `ticketing/public/posters/event-1.jpg`: 440K, matches source — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or trust boundaries introduced beyond what was specified in the plan's threat model. The `public/` directory contains only the `posters/` subdirectory with no index or secrets (T-09-04 mitigation satisfied). Express's built-in path sanitization handles path traversal (T-09-05).

## Known Stubs

None. The poster image is a real asset (1000002317.jpg — the May 29 Utility + Roller Dome + After School Special show poster) and is wired directly to the event page via `event.id`.

## Self-Check: PASSED

- ticketing/index.js: `express.static(path.join(__dirname, 'public'))` present on line 31 — confirmed
- ticketing/public/posters/event-1.jpg: exists, 440K — confirmed
- posters/event-1.jpg: exists, 440K — confirmed
- ticketing/src/views/event.ejs: 2x `poster-img`, 1x `onerror` — confirmed
- Commits 440efe8, fa32d8e, 13cdf96: all present in git log — confirmed
