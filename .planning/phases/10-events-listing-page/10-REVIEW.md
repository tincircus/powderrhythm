---
phase: 10-events-listing-page
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - ticketing/src/routes/listing.js
  - ticketing/src/views/events-list.ejs
  - ticketing/index.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the listing route handler, the events-list EJS template, and the application entry point. The route logic is structurally sound — pagination, confirmed-count aggregation, and badge decoration are all correct. No injection vectors exist because user input never flows into raw SQL and EJS uses escaped output (`<%= %>`) throughout.

Two bugs are present that will surface in production (Postgres) but not in local dev (SQLite): a date rendering defect caused by appending `'Z'` to a value that is already a JS `Date` object in Postgres, and a JSON error response that sends machine-readable output to a browser user. Additionally the `badgeLabel` uses "seats left" in the plural unconditionally, so "1 seats left" is rendered when exactly one seat remains.

## Warnings

### WR-01: Date display corrupted in production when Postgres returns a `Date` object

**File:** `ticketing/src/views/events-list.ejs:235`

**Issue:** The template evaluates `new Date(event.date + 'Z')` to force the datetime to be interpreted as UTC. This works correctly against SQLite (dev), where knex returns the `date` column as a plain string such as `'2026-05-29 20:00:00'` — appending `'Z'` produces valid ISO 8601 UTC.

Against Postgres (prod), knex returns `date` as a JavaScript `Date` object. Concatenating a `Date` with the string `'Z'` coerces the `Date` via `toString()`, producing a non-standard string like `'Fri May 29 2026 13:00:00 GMT-0700 (Pacific Daylight Time)Z'`. V8 parses this with the timezone from the `toString()` representation and discards the trailing `Z`, so the resulting `Date` is shifted by the server's local offset. For events stored near UTC midnight (e.g., `00:30 UTC`), the displayed calendar day becomes one day earlier than the actual show date.

The identical bug is present in `ticketing/src/views/event.ejs:221` (out of this review's file scope but worth noting).

**Fix:** Normalise on the server side before passing to the template, or guard in the template:

```javascript
// In listing.js, in the decoratedEvents map — add a normalised ISO string:
return {
  ...event,
  isSoldOut,
  badgeLabel,
  badgeClass,
  dateISO: (event.date instanceof Date)
    ? event.date.toISOString()
    : new Date(event.date + 'Z').toISOString(),
};
```

Then in the template:

```ejs
<p class="card-date"><%=
  new Date(event.dateISO).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles'
  })
%></p>
```

This removes the date-coercion logic from the template entirely and centralises it where it can be tested.

---

### WR-02: 500 error in listing route sends JSON to a browser user

**File:** `ticketing/src/routes/listing.js:73`

**Issue:** The catch block responds with `res.status(500).json({ error: 'Internal server error' })`. This is the root `GET /` route — a browser user who encounters a database failure sees raw JSON in the viewport rather than a styled error page. The `error.ejs` template exists and is used correctly in `events.js` for analogous failures.

**Fix:**

```javascript
} catch (err) {
  console.error('GET / listing error:', err);
  res.status(500).render('error', {
    message: 'Could not load upcoming shows. Please try again shortly.',
  });
}
```

---

### WR-03: Badge label uses unconditional plural ("1 seats left")

**File:** `ticketing/src/routes/listing.js:53`

**Issue:** The `badgeLabel` for the low-availability path is always `'${seatsLeft} seats left'`. When `seatsLeft === 1`, the label renders as `"1 seats left"`, which is grammatically incorrect. This is visible to end users on the events listing page.

**Fix:**

```javascript
const seatWord = seatsLeft === 1 ? 'seat' : 'seats';
badgeLabel = `${seatsLeft} ${seatWord} left`;
```

---

## Info

### IN-01: Price display silently rounds non-integer dollar amounts

**File:** `ticketing/src/views/events-list.ejs:237`

**Issue:** `(event.price_cents / 100).toFixed(0)` rounds to the nearest whole dollar. A ticket priced at `1999` cents (`$19.99`) would display as `$20`. The current seed event uses `2000` cents (`$20.00`) so this is benign today, but any future event priced at a non-round-dollar amount will display a misleading price.

**Fix:** Use `toFixed(2)` to always show cents, or add a helper that conditionally omits cents only when they are zero:

```ejs
<p class="card-price">$<%= Number.isInteger(event.price_cents / 100)
  ? (event.price_cents / 100).toFixed(0)
  : (event.price_cents / 100).toFixed(2) %></p>
```

---

### IN-02: No upper bound on `page` query parameter

**File:** `ticketing/src/routes/listing.js:12`

**Issue:** `Math.max(1, parseInt(req.query.page, 10) || 1)` clamps only the lower bound. A request with `?page=999999999` computes `offset = 19999999960` and issues a valid but wasteful query that returns zero rows. The user sees an empty listing with a "Previous" link but no events, with no indication they navigated past the end. This is a robustness gap rather than a crash.

**Fix:** Clamp `page` to `totalPages` after computing it, or validate after the count query:

```javascript
const page = Math.max(1, parseInt(req.query.page, 10) || 1);
// ... after totalPages is computed:
const safePage = Math.min(page, totalPages);
// use safePage for offset and pagination object
```

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
