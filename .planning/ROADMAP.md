# Roadmap: Powder Rhythm Ticketing

## Overview

Six phases take the ticketing system from a bare database schema to a production-hardened app live before the May 29 venue launch. Each phase delivers a coherent, verifiable slice of capability: Phase 1 establishes the data foundation, Phase 2 closes the first purchase end-to-end, Phase 3 puts a QR code in the buyer's hands, Phase 4 gives door staff a working scanner, Phase 5 gives the venue admin visibility and a manual fallback, and Phase 6 hardens everything for Railway production.

Two additional phases (7–8) cover milestone v1.1: replacing the personal blog with a clean business presence on the static main site.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### Milestone v1.0 — Ticketing

- [ ] **Phase 1: Foundation** - Database module, full schema, startup migrations, and health check
- [x] **Phase 2: Square Integration** - Event page, checkout redirect, webhook processing, pending page, and all webhook security (completed 2026-05-14)
- [x] **Phase 3: Confirmation + QR** - Permanent ticket page with QR code display, PNG download, and no-email warning (completed 2026-05-21)
- [x] **Phase 4: Door Scanner** - Password-protected scan page, camera QR scanning, atomic scan endpoint, green/red feedback (completed 2026-05-21)
- [ ] **Phase 5: Admin Panel** - Attendee list, live headcount, manual check-in, and name search
- [ ] **Phase 6: Production Hardening** - Railway deployment, Postgres config, rate limiting, go-live verification

### Milestone v1.1 — Website Redesign

- [ ] **Phase 7: Strip and Rebuild Layout** - Remove all blog content and interactive widgets; rebuild page structure with Powder Rhythm visual identity and updated navigation
- [ ] **Phase 8: Business Content** - Shows section with JS-driven rendering and contact/location section

## Phase Details

### Phase 1: Foundation

**Goal:** The data layer is running and verifiably healthy so every subsequent phase can build on it.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** (none — infrastructure only)
**Success Criteria:**

1. `GET /health` returns 200 with a JSON response confirming the server is up
2. The `events`, `tickets`, and `processed_webhook_events` tables exist after startup with no manual migration step
3. A seed event row exists so the event page has something to display in Phase 2

**Plans:** 2 plans

Plans:

- [x] 01-01-PLAN.md — Knex dual-client module, directory scaffold, schema migration (events/tickets/processed_webhook_events), seed event row
- [x] 01-02-PLAN.md — Express app entrypoint, GET /health route, stub route and middleware files; Walking Skeleton functional

### Phase 2: Square Integration

**Goal:** A buyer can view the event page, initiate a Square checkout, and have a ticket row created in the database when payment completes.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** PURCH-01, PURCH-02, PURCH-03, SEC-01, SEC-02
**Success Criteria:**

1. Buyer sees event name, date, venue, all-in price, and seats remaining on the event page
2. Buyer is shown a sold-out state and the Square redirect is blocked when the event is at capacity (PURCH-02)
3. A completed Square sandbox payment creates exactly one ticket row with buyer name and email captured (PURCH-03)
4. Sending the same webhook event twice results in only one ticket row — the duplicate is silently ignored (SEC-02)
5. A webhook request with an invalid HMAC signature is rejected with 400 before any processing occurs (SEC-01)

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Square SDK install, Phase 2 migration (status + square_order_id), Square singleton, GET / event page with concert poster layout and capacity badge

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — POST /checkout: validation, capacity gate, pending ticket INSERT, Square paymentLinks.create(), square_order_id UPDATE, redirect to Square
- [x] 02-03-PLAN.md — POST /webhooks/square: raw body HMAC verification (SEC-01), event filtering, idempotency INSERT (SEC-02), ticket confirmation UPDATE

**Wave 3** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — GET /ticket/pending and GET /api/ticket-status: pending page with 2s polling, 30s timeout, redirect on confirmed

**Cross-cutting constraints:**

- All routes use `const db = require('../db/knex')` — never re-instantiate Knex
- Capacity counts `status = 'confirmed'` tickets only — pending rows from abandoned checkouts never count (D-08)
- HMAC verification requires `req.rawBody` (raw string, not re-serialized JSON) — set via `express.json({ verify })` in index.js

### Phase 3: Confirmation + QR

**Goal:** After payment, a buyer lands on a permanent page with a scannable QR code they can download or bookmark.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** CONF-01, CONF-02, CONF-03, CONF-04
**Success Criteria:**

1. The pending page polls and redirects to `/ticket/:uuid` within 15 seconds of payment completing (CONF-01)
2. The confirmation page displays the buyer's QR code encoding the full ticket URL (CONF-02)
3. Buyer can download the QR code as a PNG file directly from the confirmation page (CONF-03)
4. The confirmation page explicitly tells the buyer no email will be sent and instructs them to save or bookmark the page (CONF-04)

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — qrcode npm install (legitimacy checkpoint), GET /ticket/:uuid route, ticket.ejs confirmation page template (CONF-02, CONF-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — GET /ticket/:uuid/qr.png PNG endpoint with streaming, Content-Disposition header, stream error handling (CONF-03)

**UI hint**: yes

### Phase 4: Door Scanner

**Goal:** A staff member with a phone can scan a ticket QR code and immediately see whether it is valid or already used.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** SCAN-01, SCAN-02, SCAN-03, SEC-03
**Success Criteria:**

1. Navigating to `/scan` without the correct password shows a login prompt; correct password grants access (SCAN-01)
2. The scan page activates the phone camera and reads a QR code without any app install (SCAN-02)
3. A valid, unscanned ticket shows a full-screen green display with the buyer's name (SCAN-03)
4. An already-scanned ticket shows full-screen red with the time it was first scanned (SCAN-03)
5. The scan endpoint uses an atomic `UPDATE ... WHERE scanned_at IS NULL` so two simultaneous scans of the same ticket cannot both succeed (SEC-03)

**Plans:** 2/2 plans complete

Plans:

- [x] 04-01: GET /scan — password gate and qr-scanner (nimiq) camera UI
- [x] 04-02: POST /api/scan — atomic scan endpoint, green/red response, full-screen feedback UI

**UI hint**: yes

### Phase 5: Admin Panel

**Goal:** Venue staff can see every attendee, live headcount, and manually check in anyone whose QR code will not scan.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria:**

1. Navigating to `/admin` without the correct password shows a login prompt; correct password grants access (ADMIN-01)
2. The admin page lists all attendees with name, email, paid status, and scan time, plus a live checked-in vs total-sold headcount at the top (ADMIN-02)
3. Admin can click a button to manually mark an attendee as checked in when the QR code fails (ADMIN-03)
4. Admin can type a name into a search field to filter the attendee list in real time without a page reload (ADMIN-04)

**Plans:** TBD

Plans:

- [ ] 05-01: GET /admin — password gate and attendee list with headcount
- [ ] 05-02: Manual check-in endpoint and client-side name search

**UI hint**: yes

### Phase 6: Production Hardening

**Goal:** The app is deployed on Railway with Postgres, rate limiting, graceful shutdown, and a verified production Square webhook — ready to handle the May 29 event.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** SEC-04
**Success Criteria:**

1. The app boots on Railway connected to managed Postgres with no manual schema step (migrations run at startup)
2. The scan endpoint (`/api/scan`) rejects excessive requests with 429 to prevent UUID enumeration (SEC-04)
3. The app handles SIGTERM gracefully — in-flight requests complete before the process exits
4. A real production Square webhook is registered and verified with a live test charge at least 72 hours before May 29

**Plans:** TBD

Plans:

- [ ] 06-01: Railway environment config, Postgres connection (DATABASE_PRIVATE_URL, SSL), graceful SIGTERM shutdown
- [ ] 06-02: Rate limiting on /api/scan, production Square webhook registration, end-to-end mobile verification

---

## Milestone v1.1 — Website Redesign

Replace the personal blog with a clean business presence for Powder Rhythm. The site (`index.html`) is a single static file — no build step, no server. Two phases: strip the blog content and rebuild the layout skeleton, then populate the business sections.

### Phase 7: Strip and Rebuild Layout

**Goal:** The site is a clean, identity-consistent shell with no blog content — existing visual identity preserved, navigation updated, interactive widgets gone.
**Depends on:** Nothing (independent track from Phase 6)
**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, VIS-01, VIS-02, VIS-03
**Success Criteria:**

1. Opening `index.html` in a browser shows no blog entries, no evidence board, no brick wall teardown, and no count-up timer (CLEAN-01, CLEAN-02)
2. No snowflakes or star particles appear on the page — the background is clean (CLEAN-03)
3. The existing Google Fonts (Special Elite, Permanent Marker, Fredoka One, Boogaloo) and neon color palette are present and render correctly (VIS-01)
4. The navigation links point to `#shows` and `#contact` only — no stale blog anchors (VIS-02)
5. The page is readable on a phone screen with no horizontal scroll or layout breakage (VIS-03)

**Plans:** 2 plans

Plans:

**Wave 1**

- [ ] 07-01-PLAN.md — Remove all blog/widget HTML, update head/nav/header/marquee/footer copy, add section skeletons, remove script block

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-02-PLAN.md — CSS purge: remove dead styles for removed elements; add .site-section, .section-title, .section-content rules

**UI hint**: yes

### Phase 8: Business Content

**Goal:** A visitor can find upcoming shows with ticket links and all the contact/location information they need to get to the venue.
**Depends on:** Phase 7
**Requirements:** SHOW-01, SHOW-02, SHOW-03, SHOW-04, CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria:**

1. Adding a show object to the JavaScript array and reloading the page renders it in the shows section with artist name, date, and venue name — no HTML editing required (SHOW-01, SHOW-02)
2. A show with a `ticketUrl` displays a "Get Tickets" link; a show without one displays no link at all (SHOW-03)
3. When the shows array is empty, the shows section displays "No upcoming shows — check back soon" (SHOW-04)
4. The contact section displays the physical address, cross-street, store/venue hours, and a phone number or email address (CONT-01, CONT-02, CONT-04)
5. The contact section includes at minimum a working Instagram link (CONT-03)

**Plans:** TBD
**UI hint**: yes

## Progress

**Execution Order:**
Ticketing phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6
Website redesign phases execute independently: 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Square Integration | 4/4 | Complete    | 2026-05-20 |
| 3. Confirmation + QR | 2/2 | Complete   | 2026-05-21 |
| 4. Door Scanner | 2/2 | Complete   | 2026-05-21 |
| 5. Admin Panel | 0/2 | Not started | - |
| 6. Production Hardening | 0/2 | Not started | - |
| 7. Strip and Rebuild Layout | 0/2 | Not started | - |
| 8. Business Content | 0/? | Not started | - |
