---
phase: 04-door-scanner
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - ticketing/src/views/scan-login.ejs
  - ticketing/src/views/scan.ejs
  - ticketing/src/middleware/auth.js
  - ticketing/src/routes/scan.js
  - ticketing/index.js
  - ticketing/package.json
  - ticketing/test/scan-api.test.js
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase delivers the door-scanner feature: a cookie-authenticated camera UI (`scan.ejs`) backed by two API endpoints — `POST /api/scan` for atomic check-in and `GET /api/scan/search` for name/email fallback lookup. The auth middleware (`auth.js`) is well-structured with timing-safe comparisons and HMAC token cookies.

Three blocking defects were found:

1. The `POST /api/scan` endpoint admits holders of any ticket UUID regardless of payment status — a pending (unpaid) ticket can be scanned in.
2. Search results from `GET /api/scan/search` are inserted into the DOM via `innerHTML` with no HTML encoding, enabling stored XSS against scanner staff.
3. After a successful atomic UPDATE, the follow-up `SELECT` has no null guard — a `TypeError` crash is inevitable in the (rare) race where a ticket row disappears between the two queries.

---

## Critical Issues

### CR-01: Scan endpoint accepts unconfirmed (unpaid) tickets

**File:** `ticketing/src/routes/scan.js:63-66`

**Issue:** The atomic UPDATE at lines 63-66 only checks `scanned_at IS NULL`. It does not filter on `status = 'confirmed'`. A ticket row is created with `status = 'pending'` the moment a buyer hits the checkout endpoint (see `ticketing/src/routes/events.js:62`); the webhook later flips it to `'confirmed'` once Square reports payment. If a buyer abandons payment, the pending UUID persists. Anyone who knows or guesses a pending UUID can scan it in at the door without ever paying.

**Fix:**
```js
const rowsAffected = await db('tickets')
  .where({ uuid, status: 'confirmed' })   // <-- add status guard
  .whereNull('scanned_at')
  .update({ scanned_at: db.fn.now() });
```

The same `status: 'confirmed'` guard should also be added to the `not_found` / `already_scanned` lookup at line 75 to avoid leaking the existence of pending tickets:
```js
const ticket = await db('tickets')
  .select('buyer_name', 'scanned_at')
  .where({ uuid, status: 'confirmed' })
  .first();
```

---

### CR-02: Stored XSS — search results injected into innerHTML without encoding

**File:** `ticketing/src/views/scan.ejs:255-257`

**Issue:** `buyer_name` and `buyer_email` returned by `GET /api/scan/search` are concatenated directly into an HTML string and assigned to `searchResults.innerHTML`:

```js
searchResults.innerHTML = items.map(t =>
    '<li><span>' + t.buyer_name + ' — ' + t.buyer_email + '</span>' +
    '<button class="checkin-btn" data-uuid="' + t.uuid + '">Check In</button></li>'
).join('');
```

A buyer who submits a name such as `<img src=x onerror="fetch('/api/scan',{method:'POST',body:...})">` during ticket purchase will cause arbitrary JavaScript to execute in the scanner's browser when a staff member searches for them. The scanner is authenticated, so the attacker could script automatic check-ins or read cookie values.

**Fix:** Replace the `innerHTML` assignment with DOM construction using `textContent`, which never interprets markup:

```js
searchResults.innerHTML = '';   // clear safely
items.forEach(t => {
    const li  = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = t.buyer_name + ' — ' + t.buyer_email;
    const btn = document.createElement('button');
    btn.className = 'checkin-btn';
    btn.dataset.uuid = t.uuid;
    btn.textContent = 'Check In';
    btn.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        scanner.stop();
        await handleScan(btn.dataset.uuid);
    });
    li.append(span, btn);
    searchResults.appendChild(li);
});
```

Note: the inline event-listener wiring in the loop can be removed since the listener is attached directly here, eliminating the `querySelectorAll` pass that follows in the original code.

---

### CR-03: Null dereference crash after successful atomic scan

**File:** `ticketing/src/routes/scan.js:70-71`

**Issue:** After `rowsAffected === 1` confirms the ticket was just checked in, a second query fetches `buyer_name` for the response:

```js
const ticket = await db('tickets').select('buyer_name').where({ uuid }).first();
return res.json({ ok: true, name: ticket.buyer_name });  // ticket could be undefined
```

`knex#first()` returns `undefined` when no row matches. If the ticket row is deleted between the UPDATE and this SELECT (e.g., a manual DB cleanup, a concurrent admin action, or a future soft-delete feature), `ticket.buyer_name` throws `TypeError: Cannot read properties of undefined`. The `catch` block at line 80 would surface this as a 500, but the check-in itself already succeeded — the door staff will see a server error on a legitimately valid ticket and may deny entry.

**Fix:**
```js
const ticket = await db('tickets').select('buyer_name').where({ uuid }).first();
return res.json({ ok: true, name: ticket ? ticket.buyer_name : null });
```

---

## Warnings

### WR-01: `COOKIE_MAX_AGE` is defined independently in two files

**File:** `ticketing/src/routes/scan.js:9` and `ticketing/src/middleware/auth.js:5`

**Issue:** `auth.js` defines and exports `COOKIE_MAX_AGE` (12 hours). `scan.js` imports `{ makeAuthMiddleware, makeToken, compareStrings }` from `auth.js` but then redeclares the constant locally at line 9 instead of importing the already-exported value. The two values happen to be identical today, but if the session lifetime is ever changed in one file, the other will silently diverge.

**Fix:**
```js
// scan.js line 6 — add COOKIE_MAX_AGE to the destructured import
const { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE } = require('../middleware/auth');
// Remove the local declaration at line 9.
```

---

### WR-02: QrScanner loaded from CDN with no Subresource Integrity (SRI) hash

**File:** `ticketing/src/views/scan.ejs:179`

**Issue:**
```js
import QrScanner from 'https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js';
```

A version tag (`@1.4.2`) is present, but there is no `integrity` attribute. If jsDelivr serves a tampered file (CDN compromise, BGP hijack), the attacker controls the scanner page's JavaScript running under the authenticated staff session — the authenticated cookie is accessible and all scan API calls can be manipulated.

**Fix:** Compute the SHA-384 hash of the locked file and add an integrity attribute. For an ES module `import` statement, the script tag itself needs `integrity`; since this is a dynamic `import()` inside a module script, the standard approach is to use an import map with an integrity field, or switch to a bundled/vendored copy of the library. The simplest mitigation is to vendor the file into the project under `ticketing/public/` and serve it locally.

---

### WR-03: LIKE wildcard metacharacters (`%`, `_`) are not escaped in search term

**File:** `ticketing/src/routes/scan.js:115-116`, `125-126`

**Issue:** The search term is used as `'%' + term + '%'` in parameterized LIKE queries. This prevents SQL injection (the value is parameterized), but LIKE metacharacters `%` and `_` inside the term are not escaped. A query of `%` matches every confirmed ticket. A query of `_` matches every row with a single-character name. Under the `sameSite: strict` cookie policy, a CSRF attack cannot trigger this, but a legitimate staff member can inadvertently — or maliciously — exfiltrate the entire attendee list with a single character query.

The server-side guard at line 100 only rejects empty strings; a single `%` passes through.

**Fix:** Escape LIKE metacharacters before interpolation:
```js
const safeTerm = term.replace(/[%_\\]/g, '\\$&');
// Then use: '%' + safeTerm + '%'
// And add ESCAPE '\\' to the LIKE clause where supported.
```
Also add a minimum-length guard (e.g., `term.length < 2`) mirroring the client-side check.

---

## Info

### IN-01: Test suite has no coverage for the pending-ticket bypass (CR-01) or the LIKE wildcard issue (WR-03)

**File:** `ticketing/test/scan-api.test.js`

**Issue:** The stub always returns rows regardless of status; no test case verifies that a `status: 'pending'` ticket is rejected by `POST /api/scan`. Similarly, no test exercises the search endpoint with metacharacter inputs or verifies the response shape when real rows are returned (the "with query" test asserts only that the body is an array, not its contents).

**Fix:** Add test cases:
- `POST /api/scan` with a pending-ticket stub (rowsAffected = 0, stubbed row has `status: 'pending'`) should return `ok: false, reason: 'not_found'` once CR-01 is fixed.
- `GET /api/scan/search?q=%` should return `[]` or at most a bounded result (once WR-03 is fixed).
- A test for search results verifying `buyer_name` and `uuid` are present in the response body.

---

### IN-02: `whereILike` fallback silently swallows all errors, not just "method not found"

**File:** `ticketing/src/routes/scan.js:119-129`

**Issue:** The inner `try/catch` around the `whereILike` call catches any error thrown by that block, including transient DB connectivity failures. If Postgres goes down mid-request, the code silently retries with the raw-SQL fallback, which will also fail, and the outer `catch` at line 133 catches that and returns a 500. The symptom is the same (500), but the logged error will be from the fallback query, not the original connectivity error, making diagnosis harder.

**Fix:** Narrow the catch to check whether the error is specifically a "function does not exist" type error (or catch only `TypeError` for missing method), and re-throw anything else:
```js
} catch (iLikeErr) {
    if (typeof db('tickets').whereILike !== 'function') {
        // Knex too old — fall back to whereRaw
        rows = await db('tickets') /* ... */;
    } else {
        throw iLikeErr; // real DB error — propagate to outer handler
    }
}
```
A cleaner long-term fix is to check Knex version at startup and select the query strategy once.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
