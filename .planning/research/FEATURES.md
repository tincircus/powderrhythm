# Features Research — Event Ticketing

**Domain:** Small-venue general admission concert ticketing
**Project:** Powder Rhythm, Baker City OR — ~100-500 capacity
**Researched:** 2026-05-14
**Overall confidence:** HIGH for table stakes and scanner UX; MEDIUM for differentiators (sourced from platform marketing + community patterns)

---

## Table Stakes

Must-haves. Missing any of these causes buyers to abandon, distrust the purchase, or have a broken door experience.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Total price shown before payment | FTC Junk Fees Rule (effective 2025) requires all-in pricing upfront. Buyers abandon at 39% rate when surprised by fees. | Low | Square Checkout handles this if price is set correctly — no hidden adds |
| Mobile-optimized event page | 58%+ of ticket transactions happen on mobile. Non-responsive pages read as unprofessional and create checkout errors. | Low | Standard with any modern HTML/CSS |
| Clear event details on purchase page | Name, date, time, venue address, ticket price, and capacity/availability. Buyers need this before committing. | Low | Must include: artist/event name, date, time, address, door time vs show time if different |
| Instant post-purchase confirmation | Attendees expect immediate reassurance after payment. Any delay reads as a failed transaction. | Low | Redirect to confirmation page immediately after Square webhook fires |
| Unique, scannable QR code per ticket | Industry standard. Scan-and-go entry is now expected at any venue using digital tickets. | Medium | Each ticket needs a cryptographically unique token, not a sequential ID |
| Duplicate scan detection | Prevents ticket sharing / fraud. Staff need to know immediately if a code has already been used. | Medium | Critical — a red/already-scanned state at the door is non-negotiable |
| Capacity enforcement | Buyers expect "sold out" to mean sold out. Overselling destroys trust and creates a scene at the door. | Medium | Must enforce at checkout, not just display |
| Clear sold-out state | Once capacity is hit, the event page must clearly say so. Buyers who reach checkout and fail after entering info are very unhappy. | Low | Gate purchase button before checkout redirect |

---

## Differentiators

Features that independent venues use to beat Eventbrite/TicketFairy. Not expected by default, but meaningful when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| No service fees (or absorbed into price) | Eventbrite charges 3.7% + $1.79 + 2.9% processing. Buyers notice and resent it. "No fees" is a genuine selling point. | Low | Square's processing fee is unavoidable, but no additional platform markup communicates honesty |
| Venue-branded experience | Generic Eventbrite pages dilute local identity. A page that looks and feels like Powder Rhythm builds trust and loyalty for a venue launch. | Low | Custom domain (tickets.powderrhythm.com), venue logo, color palette — already baked into the plan |
| Plain-language policy | "Refunds handled at the door" or "contact us at X" beats dense legalese. Small venue friendliness is a real differentiator. | Low | One paragraph, not a wall of boilerplate |
| Live seat/capacity counter | Showing "47 tickets remaining" creates authentic urgency without dark patterns. Buyers appreciate transparency. | Low | Already in scope — display remaining capacity on event page |
| Direct relationship (no middleman data capture) | Eventbrite owns attendee data. Your own system means you own the email list and can market future events directly. | Low | Collect name + email at purchase; store in your own DB |
| Fast door entry | Scan-and-go via phone browser with instant green/red feedback feels modern and smooth. Better experience than paper lists or slow app logins. | Medium | Good scanner UX is a real differentiator vs venues using paper or clipboard check-in |

---

## Anti-Features

Things to deliberately NOT build for MVP. Each one has a reason; defer or drop entirely.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Email ticket delivery | Adds Resend/SendGrid integration, bounce handling, spam risk, and "I didn't get my ticket" support volume. The confirmation page QR is sufficient for a 100-500 person local show. | Confirmation page with prominent download button and bookmark prompt |
| Buyer accounts / login | Creates auth surface, password reset flow, session management — all for an audience of locals who trust the venue. No meaningful benefit at this scale. | Anonymous purchase; ticket lives at the confirmation URL |
| Apple Wallet / Google Wallet integration | Requires Apple developer enrollment, passkit server, certificate management. Real lift for marginal benefit at a small venue launch. | Downloadable QR image (PNG) is universally usable — screenshot works fine |
| Multiple ticket tiers | Tier logic (early bird, VIP, GA) multiplies checkout complexity, scanner validation rules, and admin display. | Single GA price per event for MVP |
| Promo / discount codes | Code redemption requires validation logic, admin CRUD, and expiry management. Not needed for a launch event. | Manual comps can be issued as direct DB inserts if needed |
| Waitlist | Adds a second notification flow (email or SMS) when capacity opens. Not worth the complexity for first event. | Show sold-out state; direct interested parties to contact venue directly |
| Refund flow | Square Dashboard handles refunds directly. Building a refund UI adds complexity and a second payment integration surface. | Instruct buyers to contact venue; admin manually processes in Square |
| Analytics / reporting beyond attendee list | Revenue charts, cohort analysis, conversion funnels — none of this is useful for event 1. | Attendee list with paid status and scan time is sufficient |
| PDF ticket download | PDF generation (puppeteer, wkhtmltopdf) adds a dependency and infrastructure overhead. A PNG QR image is lighter and equally valid. | Serve QR as a PNG download; include basic event text in the image |
| Multi-event support | Building an event catalog, event management CRUD, and routing adds scope. This is a single-event launch. | Hardcode (or env-configure) the single event; generalize after ship |

---

## Buyer UX Expectations

### Is a confirmation page with QR download sufficient — or do buyers expect email?

**Short answer: For a local venue at this scale, confirmation page + QR download is sufficient, but there is real friction to mitigate.**

The broad industry norm (Eventbrite, Humanitix, Tixr) is email delivery with an embedded QR. 94% of buyers in general e-commerce select digital delivery, and the standard mental model is "I'll get an email I can pull up later." Skipping email introduces a new user behavior: the buyer must bookmark or screenshot the confirmation page before closing it.

The risk is not that buyers reject this flow — most will adapt — but that buyers who close the tab and later can't find their ticket will contact the venue or simply not come. At 100-500 capacity this is a manageable support surface; at 5,000 it would not be.

**Mitigation required on the confirmation page:**

1. **Large, persistent prompt:** "Save this page or download your QR — this is your ticket. You will not receive an email." The word "not" must appear. Ambiguity causes support requests.
2. **Prominent download button:** One tap to save the QR as a PNG to camera roll. On iOS this means a standard `<a download>` link with a JPEG/PNG (not a PDF — iOS Safari handles those poorly inline).
3. **Unique URL permanence:** The confirmation URL (e.g., `/ticket/abc123xyz`) should remain valid and re-loadable. If a buyer bookmarks it, it must still show the QR on revisit. Do not expire confirmation pages.
4. **Screenshot affordance:** The QR should be large enough to screenshot legibly — at least 300x300px on a 375px-wide phone screen.
5. **Add to home screen hint (optional):** A small "Add to home screen for easy access" note costs nothing and dramatically reduces lost-ticket support.

### What information belongs on the confirmation page?

- QR code (large, centered, high contrast)
- Event name, date, time, venue address
- Buyer name (for door name-check fallback)
- Unique ticket/order ID (for admin lookup if QR fails)
- Download button (QR as PNG)
- Clear language: "This is your ticket. Show QR at the door."
- Venue contact info for questions

---

## Scanner UX

### What door staff need for a smooth, high-confidence scan experience.

**Context:** 1-2 personal phones, camera-based via browser (`html5-qrcode`), no hardware scanners, ~100-500 people arriving in clusters around door time.

### Critical feedback requirements

| Requirement | Specification | Why |
|-------------|--------------|-----|
| Unambiguous color response | Full-screen green for valid, full-screen red for invalid/already-used | Staff are scanning in a crowd; peripheral color is readable without staring at text |
| Audio + vibration | A distinct tone or buzz on valid vs invalid | Venues are loud. Visual alone is not sufficient in a concert environment |
| Clear status text | "VALID — [Name]" or "ALREADY SCANNED — [Name] checked in at 7:43pm" | Staff need to know who the ticket belongs to if challenged |
| Fast reset | Scanner returns to camera view in under 2 seconds after a scan result | Throughput matters at door-rush — slow reset creates queues |
| Large scan target | Viewfinder fills most of the screen | Staff should be able to scan without precise alignment; people hold phones at all angles |

### Secondary requirements

- **Works at arm's length in low light:** The confirmation QR should use maximum contrast (black on white, minimum 3:1 per WCAG 1.4.11). The scanner page should not dim the device or use dark UI around the viewfinder.
- **Offline resilience:** If the venue's Wi-Fi cuts out or phone signal drops at door rush, scans should queue locally and reconcile when connection returns. At minimum, the scanner should fail gracefully rather than locking out — acceptable degradation is a manual name-check against the admin list.
- **No login friction at the door:** Scanner page accessed via a bookmarked URL with a shared password (already the plan). Staff should not need to log in per-session. Session should persist for the event.
- **Manual check-in fallback:** Admin page must allow tapping a name to mark as checked in without scanning. Power goes out, phone dies, QR is damaged — staff need a second path.
- **Attendee name visible immediately:** Don't make staff read a confirmation message — show the name large so they can also do a verbal confirm if needed.

### Pre-event checklist (for ops, not a feature — but informs design)

The scanner experience should be testable before the event. Design the scanner page so it works correctly against the sandbox database and with test QR codes so staff can practice the flow before doors open.

---

## Admin UX

### Most valuable features, separated by when they're needed.

### Setup time (days before the event)

| Feature | Value | Notes |
|---------|-------|-------|
| Event configuration (name, date, time, capacity, price) | Foundational — nothing else works without it | For MVP: env vars or a single DB row; no admin UI required |
| Verify Square webhook is firing correctly | Catch integration failures before launch | Test mode in Square sandbox; log webhook payloads |
| View attendee list with paid/unpaid status | Confirm that test purchases are flowing through correctly | Table: name, email, amount, ticket ID, created_at |

### Day-of (event day, during check-in)

| Feature | Value | Notes |
|---------|-------|-------|
| Real-time attendee list with scan status | Know who has arrived, how many remain, and who is checked in | The single most important admin view |
| Live headcount: checked-in vs total sold | At a glance: "83 of 120 checked in" | Display prominently at top of admin page |
| Search / filter by name | Staff at will-call or resolving a dispute need to find a buyer fast | Client-side filter on name field is sufficient; no server round-trip needed |
| Manual check-in from admin list | Fallback when QR scan fails — tap a name, mark checked in | Required for the scanner to not be a single point of failure |
| Scan timestamp visible | "Checked in at 7:43pm" surfaces re-entry attempts or timing issues | Store scanned_at in DB; display in admin list |

### Post-event (nice to have, not needed for MVP)

| Feature | Value | Notes |
|---------|-------|-------|
| Export attendee list (CSV) | Owner may want to build an email list or review attendance | Simple CSV download endpoint; deferred |
| Revenue summary | Total tickets sold x price | Can read directly from Square Dashboard for MVP |

### What NOT to build in admin for MVP

- Role-based access (scanner vs admin) — single shared password is sufficient for 1-2 staff
- Event creation UI — configure via env or DB seed script
- Refund processing — Square Dashboard handles this
- Email blast to attendees — future feature; not needed for event 1
- Charts / graphs — attendee list table is sufficient

---

## Sources

- Eventbrite pricing and fee structure: https://www.capterra.com/p/114949/Eventbrite/pricing/
- FTC Junk Fees Rule (live event pricing disclosure): https://tseentertainment.com/event-ticketing-fees-explained/
- QR code check-in best practices: https://www.fielddrive.com/blog/event-qr-code-check-in-registrations
- Scanner feedback (audio/haptic): https://godreamcast.com/blog/solution/event-registration/qr-code-best-practices/
- Buyer digital ticket preference (78%): https://www.qrcodechimp.com/event-ticket-qr-code-guide/
- Checkout abandonment from hidden fees (39%): https://loopyah.com/blog/tools/qr-code-ticketing-system
- Independent venue differentiators: https://www.ticketfairy.com/event-ticketing/indie-music-venue-platform
- No service fee platforms: https://www.tickpick.com/blog/how-to-get-tickets-with-no-service-fees/
- WCAG QR contrast requirements: https://tetralogical.com/blog/2022/08/08/accessibility-and-qr-codes/
- Humanitix buyer journey (confirmation page flow): https://help.humanitix.com/en/articles/13548552-the-ticket-buyer-journey-on-humanitix
- Small venue scanner equipment recommendations: https://joinit.com/blog/top-qr-code-check-in-systems
- Real-time check-in dashboard patterns: https://rsvpify.com/event-dashboard/
