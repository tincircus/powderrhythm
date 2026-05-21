---
phase: 03-confirmation-qr
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - ticketing/src/routes/tickets.js
  - ticketing/src/views/ticket.ejs
  - ticketing/package.json
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
fixed: 2026-05-20T17:18:00Z
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 03 added the QR confirmation page (`GET /ticket/:uuid`), the PNG streaming endpoint (`GET /ticket/:uuid/qr.png`), the `ticket.ejs` template, and the `qrcode@1.5.4` dependency. The route logic is structurally sound: Knex parameterized queries prevent SQL injection, route ordering is correct (static `/ticket/pending` registered before the dynamic `:uuid` param, and the `:uuid/qr.png` sub-path does not shadow the `:uuid` route in Express exact-match mode), and EJS `<%= %>` auto-escaping is used consistently throughout `ticket.ejs`.

One critical finding stands out: `pending.ejs` embeds the raw UUID into a JavaScript string literal using `<%= %>` in a `<script>` block. While this pattern happens to be safe for UUID-shaped values, it will be unsafe the moment a non-UUID value reaches that template (e.g., if the `/ticket/pending?uuid=` query parameter is ever populated from a source other than Square redirect). The correct fix is JSON-encoding the value. This file was not added in phase 03 but is rendered by the `/ticket/pending` route in the file under review (`tickets.js`), and the pattern will be cargo-culted into future templates.

Three warning-level issues cover: missing UUID format validation before DB queries, an unpinned semver range for `qrcode`, and the stream error handler's inability to send a meaningful error response once headers have been flushed mid-stream (a latent UX gap, not a crash risk).

---

## Critical Issues

### CR-01: JavaScript string injection in pending.ejs via EJS HTML-escaping in `<script>` context

**File:** `ticketing/src/views/pending.ejs:86`
**Issue:** The UUID value is interpolated directly into a JavaScript string literal using `<%= uuid %>`:

```ejs
const uuid = '<%= uuid %>';
```

`<%= %>` applies HTML entity encoding (`'` → `&#39;`, `<` → `&lt;`, etc.). Inside a `<script>` block, the HTML5 specification defines the content model as "raw text" — the browser's JS parser receives the raw bytes of the script body without decoding HTML entities first. This means `&#39;` arrives in JavaScript as the six literal characters `&#39;`, not as a single quote, so the existing escaping happens to prevent string-breaking injection for this exact character.

However, this "safety" is fragile and wrong-by-default:

1. Any future deviation that passes a non-UUID value (e.g., a display name, an error message) through this same pattern would be exploitable.
2. The pattern is visually identical to code that would be vulnerable in other languages or template engines that do decode entities in script blocks.
3. The correct way to safely embed a server-side value into a JavaScript context is JSON encoding, not HTML encoding.

The `/ticket/pending` route in `tickets.js` (line 19, in scope for this review) feeds `uuid` directly from `req.query.uuid` into this template after only a DB existence check — no format normalization. A sufficiently crafted UUID-lookalike that contains characters outside the hex+hyphen alphabet would expose this fragility.

**Fix:** Use `JSON.stringify()` server-side and `<%- %>` (unescaped) in the template, which is the idiomatic safe pattern for embedding values into `<script>` blocks:

In `tickets.js` (the pending route, line 19):
```js
res.render('pending', { uuid: JSON.stringify(uuid) });
```

In `pending.ejs` line 86:
```ejs
const uuid = <%- uuid %>;
```

`JSON.stringify` on a string always produces a double-quoted JS string literal with all special characters properly escaped for a JS context. The result cannot break out of the string literal regardless of what the input contains.

---

## Warnings

### WR-01: No UUID format validation before database queries

**File:** `ticketing/src/routes/tickets.js:39,53` (also lines 17, 29)
**Issue:** All four routes accept the `uuid` parameter directly from `req.params` or `req.query` and pass it straight to Knex without validating that it matches the expected UUID v4 format. Knex parameterized queries prevent SQL injection, so there is no injection risk, but:

- Any arbitrary string (including very long strings, Unicode, null bytes) causes a full DB round-trip before returning 404/redirect.
- The `Content-Disposition` header in the `/qr.png` route (line 59) embeds `uuid` into the filename. RFC 6266 requires `"` to be escaped in quoted-string parameters. A UUID-shaped value cannot contain `"`, but there is no guarantee at the type level that the param is UUID-shaped.
- Consistent validation creates a first line of defense that the rest of the code can trust.

**Fix:** Add a UUID v4 format guard at the top of the dynamic-param routes (no additional library needed):

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// In each route handler before the DB query:
if (!UUID_RE.test(uuid)) return res.redirect('/');          // or res.status(404).end() for /qr.png
```

### WR-02: QRCode stream error handler cannot recover once headers are flushed

**File:** `ticketing/src/routes/tickets.js:60-63`
**Issue:** The stream error handler is:

```js
res.on('error', (err) => {
  console.error('QR stream error:', err);
  if (!res.headersSent) res.status(500).end();
});
```

`res.type('image/png')` and `res.setHeader(...)` queue headers but do not flush them. Headers are flushed when `QRCode.toFileStream` writes the first PNG chunk. If the QR generation error occurs after the first chunk is written (mid-stream), `res.headersSent` is `true` and the handler logs the error but does nothing to the response — the client receives a partial, malformed PNG with no error signal.

This is the inherent limitation of streaming responses and cannot be fully fixed within HTTP/1.1 without buffering. However, the current code silently drops partial responses. For a ticket-scanning use case, a buyer with a bad network could receive a broken QR image without any visible error.

**Fix (mitigation):** Buffer the PNG before streaming to eliminate the mid-stream failure window entirely. For 300x300 PNG output, the buffer is typically 3-8 KB — well within reasonable memory constraints for this application:

```js
router.get('/ticket/:uuid/qr.png', async (req, res) => {
  const { uuid } = req.params;
  if (!UUID_RE.test(uuid)) return res.status(404).end();
  const ticket = await db('tickets').select('uuid').where({ uuid, status: 'confirmed' }).first();
  if (!ticket) return res.status(404).end();
  const APP_URL = process.env.APP_URL || 'http://localhost:3000';
  const qrUrl = `${APP_URL}/ticket/${ticket.uuid}`;
  try {
    const buffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
    res.type('image/png');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${uuid}.png"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).end();
  }
});
```

`QRCode.toBuffer` returns a Promise and throws on error, making it async-friendly with standard `try/catch`. It also enables `Content-Length`, which allows clients to detect truncation.

### WR-03: `qrcode` dependency uses caret range instead of exact pin

**File:** `ticketing/package.json:19`
**Issue:**

```json
"qrcode": "^1.5.4"
```

The caret range allows any future `1.x.y` release where `x >= 5` or `y > 4` to be installed on `npm install`. For a payment-adjacent application serving ticket QR codes (scanned at the door for entry), supply-chain risk from an unreviewed package update warrants exact pinning. All other dependencies in `package.json` use exact versions (`"express": "5.2.1"`, `"knex": "3.2.10"`, etc.); `qrcode` is the only exception.

**Fix:** Pin to the exact verified version:

```json
"qrcode": "1.5.4"
```

---

## Info

### IN-01: `index.js` comment for ticketsRouter does not reflect phase 03 additions

**File:** `ticketing/index.js:26`
**Issue:** The inline comment reads:

```js
const ticketsRouter = require('./src/routes/tickets');  // GET /ticket/pending, GET /api/ticket-status
```

Phase 03 added two new routes (`GET /ticket/:uuid` and `GET /ticket/:uuid/qr.png`) that are not listed. This comment is the only per-router documentation visible at the application entry point.

**Fix:**

```js
const ticketsRouter = require('./src/routes/tickets');
// Routes: GET /ticket/pending, GET /api/ticket-status, GET /ticket/:uuid, GET /ticket/:uuid/qr.png
```

### IN-02: `ticket.ejs` has no `<meta name="robots">` to discourage indexing of ticket URLs

**File:** `ticketing/src/views/ticket.ejs:1-9`
**Issue:** The ticket confirmation page at `/ticket/:uuid` is publicly accessible to anyone with the UUID. Buyers are told "bookmark this page — this URL is your ticket." Without a `noindex` directive, search engine crawlers that follow shared links could index these pages, making individual ticket URLs discoverable.

**Fix:** Add to the `<head>` block:

```html
<meta name="robots" content="noindex, nofollow" />
```

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
