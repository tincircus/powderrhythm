# Powder Rhythm Ticketing

## What This Is

A lightweight event ticketing backend for Powder Rhythm, a record store and music venue in Baker City, Oregon. Buyers purchase tickets via Square, receive a QR code on a confirmation page, and present it at the door to be scanned from a phone browser. Lives in the `/ticketing` subfolder of the main repo, served from a subdomain (`tickets.powderrhythm.com`) via Railway.

## Core Value

A buyer can purchase a ticket and present a valid QR code at the door without any friction — no account, no app, no email required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Buyer can view event details and purchase a GA ticket via Square Checkout
- [ ] Square webhook confirms payment and creates a ticket record
- [ ] Buyer is redirected to a confirmation page with a downloadable QR code
- [ ] QR code can be scanned at the door via a phone browser
- [ ] Scanner marks ticket as used and shows green (valid) or red (already scanned / not found)
- [ ] Admin page shows attendee list with name, email, paid status, and scan time
- [ ] Admin can manually check in an attendee from the admin page
- [ ] Capacity is tracked and displayed on the event page (seats remaining)

### Out of Scope

- Apple Wallet / Google Wallet — deferred, can add after core flow ships
- Email delivery of tickets — QR on confirmation page is sufficient for MVP
- Multiple ticket tiers — GA only for now
- Promo codes / discount codes — not needed for first event
- Buyer accounts / order history — no auth for buyers
- Refund flow — handled manually via Square Dashboard
- Waitlist — not needed for first event
- Analytics / reporting beyond attendee list

## Context

- **First event:** May 29 — the Powder Rhythm venue launch. Soft launch before that date is the target.
- **Repo:** `/ticketing` subfolder within the existing `powderrhythm` GitHub repo (same git history, clean separation by directory)
- **Existing blog:** The current `index.html` blog continues unchanged at `powderrhythm.com`; the ticketing app is a new backend at `tickets.powderrhythm.com`
- **Square account:** Already established — sandbox credentials available immediately
- **Door scanning:** 1-2 personal phones, camera-based via browser (`html5-qrcode`). No hardware scanners.
- **Admin access:** Password-protected via shared env var — no user management required

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
| Shared password auth (no JWT/sessions) | Venue staff is 1-2 people, complexity of real auth isn't justified for MVP | — Pending |

---
*Last updated: 2026-05-14 after initialization*

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
