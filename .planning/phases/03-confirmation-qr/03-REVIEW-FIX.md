---
phase: 03-confirmation-qr
fixed_at: 2026-05-20T17:18:00Z
review_path: .planning/phases/03-confirmation-qr/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-20T17:18:00Z
**Source review:** .planning/phases/03-confirmation-qr/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: JavaScript string injection in pending.ejs via EJS HTML-escaping in `<script>` context

**Files modified:** `ticketing/src/routes/tickets.js`, `ticketing/src/views/pending.ejs`
**Commit:** ec91806
**Applied fix:**
- In `tickets.js` pending route: changed `res.render('pending', { uuid })` to `res.render('pending', { uuid: JSON.stringify(ticket.uuid) })` so the server produces a proper JS string literal.
- In `pending.ejs` line 86: changed `const uuid = '<%= uuid %>';` to `const uuid = <%- uuid %>;` — removes the surrounding single quotes (JSON.stringify produces them) and switches from HTML-escaped `<%= %>` to unescaped `<%- %>` since JSON.stringify handles safe encoding for the script context.

### WR-01: No UUID format validation before database queries

**Files modified:** `ticketing/src/routes/tickets.js`
**Commit:** ec91806 (included in CR-01 commit — changes were applied atomically to tickets.js)
**Applied fix:**
Added `const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;` after the require statements. Added format guards in all four dynamic-param route handlers:
- `GET /ticket/pending`: `if (!UUID_RE.test(uuid)) return res.redirect('/');`
- `GET /api/ticket-status`: `if (!UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });`
- `GET /ticket/:uuid`: `if (!UUID_RE.test(uuid)) return res.redirect('/');`
- `GET /ticket/:uuid/qr.png`: `if (!UUID_RE.test(uuid)) return res.status(404).end();`

### WR-02: QRCode stream error handler cannot recover once headers are flushed

**Files modified:** `ticketing/src/routes/tickets.js`
**Commit:** ec91806 (included in CR-01 commit — changes were applied atomically to tickets.js)
**Applied fix:**
Replaced `QRCode.toFileStream` streaming approach with `QRCode.toBuffer` + `res.end(buffer)`. The entire PNG is buffered before any headers are sent, so QR generation errors are caught in a `try/catch` before `res.type()` is called — a clean 500 can always be returned. Also added `Content-Length` header enabling client-side truncation detection.

### WR-03: `qrcode` dependency uses caret range instead of exact pin

**Files modified:** `ticketing/package.json`
**Commit:** 59b75e9
**Applied fix:**
Changed `"qrcode": "^1.5.4"` to `"qrcode": "1.5.4"` — exact pin matching the convention used by all other dependencies in the file.

## Skipped Issues

None — all findings were fixed.

---

**Verification results:**
- `node -e "require('./src/routes/tickets')"` exits 0 (LOAD OK)
- `grep "uuid.*<%= uuid %>" pending.ejs` finds no match (FIXED)
- `node -c tickets.js` passes (SYNTAX OK)
- `node -e "JSON.parse(...package.json)"` passes (JSON OK)

---

_Fixed: 2026-05-20T17:18:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
