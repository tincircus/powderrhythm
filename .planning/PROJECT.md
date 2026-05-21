# Powder Rhythm

## Current Milestone: v1.1 — Website Redesign

**Goal:** Replace the personal blog with a clean business presence for Powder Rhythm — shows/events, contact, and location — while keeping the neon/bold visual identity.

**Target features:**
- Remove all blog content and interactive widgets (evidence board, brick wall, count-up timer, snowflakes/stars)
- Shows / Events section — upcoming concerts with links to tickets.powderrhythm.com
- Contact / Location section — address, hours, phone, social links
- Visual refresh: preserve Powder Rhythm energy, remove blog chaos

**Deferred to later milestone:** About / Story section, Record Store section

## What This Is

Powder Rhythm is a record store and music venue in Baker City, Oregon. This project covers two tracks:

1. **Main site** (`powderrhythm.com`) — Static HTML/CSS/JS on Netlify. Business presence: shows, contact, location.
2. **Ticketing backend** (`tickets.powderrhythm.com`) — Node.js/Express on Railway. Buyers purchase tickets via Square, receive a QR code, and present it at the door.

### Ticketing (v1.0)

A lightweight event ticketing backend. Buyers purchase tickets via Square, receive a QR code on a confirmation page, and present it at the door to be scanned from a phone browser. Lives in the `/ticketing` subfolder of the main repo, served from a subdomain (`tickets.powderrhythm.com`) via Railway.

## Core Values

**Main site:** A visitor can find out what's playing, when, and how to get there in under 30 seconds.

**Ticketing:** A buyer can purchase a ticket and present a valid QR code at the door without any friction — no account, no app, no email required.

## Requirements

### Validated

**v1.0 — Ticketing (Phase 4)**
- [x] QR code can be scanned at the door via a phone browser — camera UI works on Mac; HTTPS required on phone (getUserMedia constraint) — Phase 4
- [x] Scanner marks ticket as used and shows green (valid) or red (already scanned / not found) — full-screen green/red overlay confirmed via UAT — Phase 4

### Active (v1.1 — Website Redesign)

- [ ] Visitor can see upcoming shows with dates, artists, and ticket links
- [ ] Visitor can find contact info, address, and hours
- [ ] Site reflects Powder Rhythm visual identity without blog clutter

### Active (v1.0 — Ticketing)

- [ ] Buyer can view event details and purchase a GA ticket via Square Checkout
- [ ] Square webhook confirms payment and creates a ticket record
- [ ] Buyer is redirected to a confirmation page with a downloadable QR code
- [ ] QR code can be scanned at the door via a phone browser
- [ ] Scanner marks ticket as used and shows green (valid) or red (already scanned / not found)
- [ ] Admin page shows attendee list with name, email, paid status, and scan time
- [ ] Admin can manually check in an attendee from the admin page
- [ ] Capacity is tracked and displayed on the event page (seats remaining)

### Out of Scope

- About / Story section — deferred to v1.2
- Record Store section — deferred to v1.2
- Apple Wallet / Google Wallet — deferred, can add after core ticketing ships
- Email delivery of tickets — QR on confirmation page is sufficient for MVP
- Multiple ticket tiers — GA only for now
- Promo codes / discount codes — not needed for first event
- Buyer accounts / order history — no auth for buyers
- Refund flow — handled manually via Square Dashboard
- Waitlist — not needed for first event
- Analytics / reporting beyond attendee list

## Context

- **First event:** May 29 — the Powder Rhythm venue launch. Soft launch before that date is the target.
- **Repo:** Single GitHub repo. Main site at root (`index.html` → Netlify). Ticketing app in `/ticketing` (Railway).
- **Main site hosting:** Static HTML/CSS/JS on Netlify at `powderrhythm.com` — no server, no build step.
- **Ticketing hosting:** Node.js/Express on Railway at `tickets.powderrhythm.com` — pay-per-use, Postgres included.
- **Square account:** Already established — sandbox credentials available immediately.
- **Door scanning:** 1-2 personal phones, camera-based via browser. No hardware scanners.
- **Admin access:** Password-protected via shared env var — no user management required.

## Constraints

- **Tech stack:** Node.js + Express (Square SDK best supported here)
- **Database:** SQLite for dev, Postgres for prod (Railway includes managed Postgres)
- **Payments:** Square Checkout Links API only — no custom card UI, no PCI scope
- **Hosting:** Railway — supports webhooks, Postgres, easy env vars, free tier available
- **Timeline:** Must be live before May 29, 2026
- **Auth:** Single shared password per env var for admin and scanner routes — no user management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Square Checkout Links (redirect) over embedded SDK | No card UI to build, no PCI scope, Square handles all payment UX | — Pending |
| QR download on confirmation page (no email) | Simpler stack, no email service required for MVP. Resend can be added later. | — Pending |
| `/ticketing` subfolder in same repo | Avoids creating a second repo for a small first event; can be extracted later | — Pending |
| Railway for hosting | Postgres included, webhook-friendly public URL, simple deploys from GitHub | — Pending |
| Shared password auth (no JWT/sessions) | Venue staff is 1-2 people, complexity of real auth isn't justified for MVP | Validated Phase 4 |
| HMAC-SHA256 token in httpOnly cookie (stateless auth) | No session store needed; token derived from password so no DB lookup on each request | Phase 4 |
| Inline 401 JSON on API endpoints (not redirect) | Browser fetch() cannot follow redirects transparently; inline JSON lets the scan UI parse errors | Phase 4 |
| Atomic UPDATE WHERE status='confirmed' AND scanned_at IS NULL | Prevents double-scan race condition AND blocks unpaid (pending) tickets from being admitted | Phase 4 |
| DOM construction (createElement/textContent) over innerHTML for search results | Prevents stored XSS from attacker-controlled buyer_name values in the authenticated scanner context | Phase 4 |
| HTTPS required on phones for camera access (getUserMedia) | Browser security restriction — scan page works on Mac over HTTP; phone deployment needs Railway HTTPS | Phase 4 |

---
*Last updated: 2026-05-21 after Phase 4 (Door Scanner) transition*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
