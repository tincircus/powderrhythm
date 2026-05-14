# Walking Skeleton — Powder Rhythm Ticketing

**Phase:** 1
**Generated:** 2026-05-14

## Capability Proven End-to-End

`GET /health` on the running Express server returns `{"status":"ok","db":"connected"}` — confirming the HTTP layer, the Knex database module, and the auto-migrated SQLite schema are all wired together and functional.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Express 5.2.1 | Project constraint; Square SDK best supported in Node; Express 5 auto-catches async errors |
| Data layer | Knex 3.2.10 — dual-client (better-sqlite3 dev / pg prod) | Project constraint; env-driven client switch eliminates dev/prod config divergence; programmatic migrate.latest() removes manual deploy steps |
| Auth | Shared password via env var (ADMIN_PASSWORD) | Single-venue staff of 1-2; full session auth adds friction and maintenance overhead not justified for MVP |
| Deployment target | Railway (managed Postgres, webhook-friendly public URL, auto-deploy from GitHub) | Project constraint; free tier available; DATABASE_URL injected natively |
| Directory layout | ticketing/ subdirectory in existing repo; src/db/, src/routes/, src/middleware/, src/views/ | Shallow structure; colocates ticketing app without polluting the static blog root; easy to extract to its own repo later |
| Templating | EJS 5.0.2 server-side rendering | Project constraint; no build step; works natively with Express; no client-side JS framework required |
| UUID generation | crypto.randomUUID() (Node built-in) | No extra dependency; available Node ≥14.17; UUIDs generated app-side before INSERT so the value is available immediately for redirect URLs |

## Stack Touched in Phase 1

- [x] Project scaffold (package.json, .gitignore, .env.example, railway.toml, directory structure)
- [x] Routing — GET /health route returning JSON, plus 5 stub route files
- [x] Database — Knex dual-client module + startup migration creating events, tickets, processed_webhook_events tables with seed event row (read + write exercised at startup)
- [x] UI — none (Phase 1 is infrastructure only; EJS views are stubs)
- [x] Deployment — documented local full-stack run: `cd ticketing && npm install && npm run dev`; Railway config in railway.toml

## Out of Scope (Deferred to Later Slices)

- Purchase flow (Square Checkout Links, event page) — Phase 2
- Webhook processing and ticket creation — Phase 2
- QR code generation and confirmation page — Phase 3
- Door scanner UI and scan endpoint — Phase 4
- Admin panel and manual check-in — Phase 5
- Railway production deploy, Postgres SSL wiring, rate limiting — Phase 6
- Apple Wallet / Google Wallet — v2
- Email ticket delivery — v2
- Security headers (helmet.js) — v2

## Subsequent Slice Plan

- Phase 2: Buyer can view the event page and complete a Square checkout, resulting in a ticket row in the database
- Phase 3: After payment, buyer lands on a permanent page with a scannable and downloadable QR code
- Phase 4: Staff member scans a ticket QR code on their phone and sees green (valid) or red (already used)
- Phase 5: Admin can view all attendees, live headcount, and manually check in by name
- Phase 6: App is live on Railway with Postgres, rate limiting, and a verified production Square webhook before May 29
