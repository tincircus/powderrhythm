---
phase: 10-events-listing-page
verified: 2026-05-21T00:00:00Z
status: human_needed
score: 5/6 must-haves verified (1 warning — wording deviation)
overrides_applied: 0
human_verification:
  - test: "Start server and confirm GET / returns 200 with 'Upcoming Shows' heading (not a 302 redirect to /events/1)"
    expected: "Browser shows the events listing page with 'Upcoming Shows' as page heading; no redirect occurs"
    why_human: "Cannot start a server in verification; HTTP response code and page heading require live execution"
  - test: "Confirm the May 29 event card shows name, date in Pacific time, venue, price, and 'Available' badge"
    expected: "Event card visible with all four fields populated correctly; availability badge reads 'Available'"
    why_human: "Requires a running server connected to the seeded DB to render real data"
  - test: "Confirm 'Get Tickets' link on card points to /events/1 and clicking it loads the event detail page without regression"
    expected: "Link href is /events/1; event detail page loads correctly"
    why_human: "Navigation behavior requires a browser or live HTTP client"
  - test: "Confirm GET /health still returns {\"status\":\"ok\",\"db\":\"connected\"} (regression check)"
    expected: "200 JSON response with status ok and db connected"
    why_human: "Requires live server and DB connection"
  - test: "Confirm 'N seats left' vs 'N left' badge wording is acceptable for this project"
    expected: "ROADMAP SC3 says 'X left'; implementation renders 'N seats left' (e.g. '5 seats left'); decide if the extra word 'seats' is acceptable"
    why_human: "Copy decision — more informative than the spec shorthand but technically deviates from ROADMAP wording; a human must decide if this is acceptable or needs alignment"
  - test: "Confirm card poster thumbnail size (56x56 px rendered) is acceptable vs PLAN spec of 110x110 px"
    expected: "PLAN action spec said 110x110; implementation renders 56x56; visually check whether the smaller size is acceptable for the card layout"
    why_human: "Visual/UX judgment; poster size does not appear in ROADMAP SCs but was in PLAN spec"
---

# Phase 10: Events Listing Page Verification Report

**Phase Goal:** The bare ticketing subdomain shows a paginated list of upcoming events with per-event availability indicators and a direct purchase button on each entry.
**Verified:** 2026-05-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET / returns an HTML page with upcoming events — not a 302 redirect | VERIFIED | `app.use('/', listingRouter)` at index.js line 48; no `redirect.*events/1` found; `node -e "require('./src/routes/listing')"` exits 0 |
| 2 | Each event card displays name, date (Pacific TZ), venue, and all-in price | VERIFIED | events-list.ejs lines 234–237: `event.name`, `event.date+'Z'` with `timeZone: 'America/Los_Angeles'`, `event.venue`, `(event.price_cents/100).toFixed(0)` |
| 3 | Availability badge: "X left" at <10 seats, "Available" at 10+, "Sold Out" at capacity | WARNING | Badge logic correct in listing.js (lines 48–58); thresholds correct (LOW_THRESHOLD=10). Wording deviation: ROADMAP SC says "X left" but implementation renders "${seatsLeft} seats left" (e.g. "5 seats left"). Count is present; extra word "seats" added. Human decision required. |
| 4 | Active events have `<a>` to /events/:id; sold-out events have disabled button "Sold Out" | VERIFIED | events-list.ejs lines 239–243: isSoldOut branch renders `<button disabled>Sold Out</button>`; else renders `<a href="/events/<%= event.id %>">Get Tickets</a>`. EJS render tests confirmed both branches. |
| 5 | When no upcoming events, page shows "No upcoming shows. Check back soon." | VERIFIED | events-list.ejs line 222: exact string present; EJS render with empty array confirmed: `has empty state: true` |
| 6 | Paginated at 20/page; ?page=N advances pages; prev/next links shown only when applicable | VERIFIED | listing.js: `PAGE_SIZE=20`, `offset=(page-1)*PAGE_SIZE`, `hasPrev: page > 1`, `hasNext: page < totalPages`. Template lines 250–255: conditional prev/next render. EJS render confirmed next shown, prev hidden for page 1 with totalPages=2. |

**Score:** 5/6 truths verified (1 WARNING on badge wording)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ticketing/src/routes/listing.js` | GET / listing handler with pagination and badge decoration, exports router | VERIFIED | File exists, 77 lines, substantive — DB queries, badge logic, pagination. `require()` exits 0. |
| `ticketing/src/views/events-list.ejs` | Events listing EJS template with cards, badges, pagination, empty state | VERIFIED | File exists, 259 lines, substantive — full DOCTYPE, CSS variables, all card fields, badge classes, empty state, pagination nav. All 11 EJS output tags use `<%= %>` (escaped). 0 uses of `<%-`. |
| `ticketing/index.js` | Root route wired to listing handler; redirect on former line 47 replaced | VERIFIED | Line 41: `require('./src/routes/listing')`. Line 48: `app.use('/', listingRouter)`. No redirect to /events/1 found. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ticketing/index.js` | `ticketing/src/routes/listing.js` | `app.use('/', require('./src/routes/listing'))` | VERIFIED | Lines 41 + 48 of index.js confirmed |
| `ticketing/src/routes/listing.js` | `ticketing/src/views/events-list.ejs` | `res.render('events-list', { events, pagination })` | VERIFIED | listing.js line 62–70: `res.render('events-list', {...})` |
| `ticketing/src/views/events-list.ejs` | `express.static /public/posters/` | `src="/posters/event-<%= event.id %>.jpg"` | VERIFIED | Template line 229; static middleware at index.js line 46 serves `public/`; `public/posters/event-1.jpg` exists on disk |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `events-list.ejs` | `events` | `listing.js` → `db('events').whereRaw('date > CURRENT_TIMESTAMP').orderBy('date','asc').limit(20).offset(N)` | Yes — Knex query against `events` table | FLOWING |
| `events-list.ejs` | `pagination` | `listing.js` → `db('events').count('id as n')` then math | Yes — count from DB | FLOWING |
| `events-list.ejs` | `event.badgeLabel`, `event.badgeClass` | `listing.js` → `db('tickets').whereIn('event_id',...).where({status:'confirmed'}).groupBy('event_id').count()` | Yes — aggregated confirmed ticket counts from DB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| listing.js module loads | `node -e "require('./src/routes/listing'); console.log('OK')"` | `OK` | PASS |
| EJS renders empty state | `ejs.render(template, { events:[], pagination:{...} })` | `has empty state: true`, `has heading: true` | PASS |
| EJS renders event card fields | `ejs.render(template, { events:[{...}], ... })` | All fields present, Get Tickets link correct | PASS |
| EJS renders sold-out state | `ejs.render(template, { events:[{isSoldOut:true,...}], ... })` | Disabled button, no Get Tickets, sold-out badge | PASS |
| EJS renders seats-left badge | `ejs.render(template, { events:[{badgeClass:'seats-left',...}], ... })` | `capacity-badge seats-left`, label text present | PASS |
| GET / is not a redirect | `grep "redirect.*events/1" index.js` | No output (exit 1) | PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` probes for this phase.

### Requirements Coverage

No formal requirement IDs declared for this phase (internal improvement). ROADMAP success criteria SC1–SC6 verified in the truths table above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `events-list.ejs` | 75–76 | `card-poster` CSS: `width: 56px; height: 56px` (PLAN spec said 110x110) | Warning | Visual deviation from PLAN action spec; poster thumbnail smaller than designed. No ROADMAP SC broken. Human sign-off needed. |

No TBD, FIXME, XXX, or TODO markers found in any phase-modified file.

### Human Verification Required

#### 1. Live Server: GET / Returns 200 with Events Listing Page

**Test:** Start the server (`cd ticketing && node index.js`) and visit `http://localhost:3000/`
**Expected:** Page heading "Upcoming Shows" visible; no redirect occurs; HTTP 200 response
**Why human:** Cannot start a server in verification; HTTP response code requires live execution

#### 2. May 29 Event Card Data

**Test:** With server running, confirm the May 29 event card shows name, date (Pacific time), venue, price, and "Available" badge
**Expected:** All four fields populated from DB; badge reads "Available" (confirmed=0, capacity=20, so 20 seats left >= 10)
**Why human:** Requires running server + seeded DB to render real data from the events table

#### 3. Get Tickets Navigation (Regression)

**Test:** Click "Get Tickets" on the May 29 card; confirm it loads `GET /events/1` correctly
**Expected:** Event detail page loads without error; no regression from Phase 9
**Why human:** Navigation behavior requires a browser or live HTTP client

#### 4. Health Endpoint Regression

**Test:** `curl http://localhost:3000/health`
**Expected:** `{"status":"ok","db":"connected"}`
**Why human:** Requires live server + DB connection

#### 5. Badge Wording Decision: "N seats left" vs "N left"

**Test:** Review the availability badge wording in context
**Expected:** ROADMAP SC3 specifies "X left" as the badge copy. Implementation renders "5 seats left" (includes the word "seats"). Confirm whether "N seats left" is acceptable or must match "N left" exactly.
**Why human:** Copy/wording decision — the count is correct but the literal string differs from the ROADMAP shorthand. If rejected, listing.js line 53 must change `\`${seatsLeft} seats left\`` to `\`${seatsLeft} left\``.

#### 6. Card Poster Thumbnail Size

**Test:** View the events listing page at desktop width
**Expected:** PLAN action spec specified `width: 110px; height: 110px` for `.card-poster`. Implementation has `width: 56px; height: 56px`. Confirm whether the 56px size is acceptable.
**Why human:** Visual/UX judgment; not in ROADMAP SCs but was in PLAN spec

### Gaps Summary

No functional gaps. All six ROADMAP success criteria are either verified (SC1, SC2, SC4, SC5, SC6) or warrant a human copy decision (SC3 — badge wording "N seats left" vs "N left"). Two UI deviations from PLAN spec need human sign-off: badge wording and card poster size. Neither deviation breaks the ROADMAP success criteria functionally. The human checkpoint from PLAN Task 3 was not completed before submission.

---

_Verified: 2026-05-21_
_Verifier: Claude (gsd-verifier)_
