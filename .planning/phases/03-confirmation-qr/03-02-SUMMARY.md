---
phase: 03-confirmation-qr
plan: "02"
subsystem: ticketing/confirmation
tags: [qr-code, png-endpoint, express, nodejs, qrcode]
dependency_graph:
  requires:
    - phase: 03-01
      provides: "qrcode dependency installed, GET /ticket/:uuid route, ticket.ejs template with /qr.png img src"
  provides:
    - "GET /ticket/:uuid/qr.png — streams valid PNG QR code encoding full ticket URL"
    - "Content-Disposition: attachment header for iOS Safari download"
    - "T-03-06 stream error mitigation via res.on('error')"
  affects: [phase-04-scanner, phase-05-admin]
tech_stack:
  added: []
  patterns:
    - "QRCode.toFileStream pipes PNG bytes directly to res stream; errors emitted on the stream itself (not returned)"
    - "Stream error guard: res.on('error') must be attached before calling toFileStream"
key_files:
  created: []
  modified: [ticketing/src/routes/tickets.js]
key_decisions:
  - "QRCode.toFileStream returns undefined (not the stream) — errors are emitted on the passed stream (res), requiring res.on('error') not chained .on('error')"
  - "APP_URL fallback to http://localhost:3000 is safe for dev; prod must set APP_URL=https://tickets.powderrhythm.com"
  - "select('uuid') only in /qr.png route — no PII needed, consistent with T-03-05 accept disposition"
requirements-completed: [CONF-03]
duration: 3min
completed: "2026-05-20"
---

# Phase 03 Plan 02: QR PNG Download Endpoint Summary

GET /ticket/:uuid/qr.png endpoint streaming 300x300 PNG QR code with Content-Disposition attachment and stream error guard via res.on('error').

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-20T23:47:41Z
- **Completed:** 2026-05-20T23:51:18Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments

- Added GET /ticket/:uuid/qr.png route to tickets.js that streams a 300x300 PNG QR code
- QR encodes full APP_URL + /ticket/:uuid (not bare UUID) so Phase 4 scanner reads a navigable URL
- Content-Disposition: attachment; filename="ticket-{uuid}.png" for iOS Safari download fallback
- T-03-06 mitigated: res.on('error') attached before streaming to prevent server crash

## Task Commits

1. **Task 1: Add GET /ticket/:uuid/qr.png endpoint** - `e646248` (feat)

2. **Task 2: Verify QR code scans correctly on a real device** - checkpoint:human-verify — APPROVED by human reviewer.

## Files Created/Modified

- `ticketing/src/routes/tickets.js` - Added GET /ticket/:uuid/qr.png route (22 lines)

## Decisions Made

- `QRCode.toFileStream` returns `undefined`, not the stream. The qrcode library's implementation uses `stream.emit.bind(stream, 'error')` as the error callback, so errors are emitted on the stream argument (res) itself. Changed from chained `.on('error')` to `res.on('error')` — this is a Rule 1 bug fix discovered during verification.
- select('uuid') only in the /qr.png route to avoid selecting PII (buyer_name, buyer_email). The uuid is the only field needed to build the QR URL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] QRCode.toFileStream returns undefined, not a chainable stream**
- **Found during:** Task 1 verification (live server test)
- **Issue:** Plan and RESEARCH.md specified `.on('error')` chained on toFileStream's return value. The actual qrcode@1.5.4 implementation returns undefined (confirmed by inspecting node_modules/qrcode/lib/server.js). Chaining `.on('error')` on undefined caused a TypeError that crashed the route handler.
- **Fix:** Attached `res.on('error', ...)` before calling `QRCode.toFileStream(res, ...)`. Since toFileStream uses `stream.emit.bind(stream, 'error')` as its internal error callback, errors are emitted on the res stream itself.
- **Files modified:** ticketing/src/routes/tickets.js
- **Verification:** Live server test — confirmed 200 + PNG for confirmed UUID, 404 for unknown UUID, no TypeError in server logs.
- **Committed in:** e646248 (Task 1 commit, fix included)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in error handler pattern)
**Impact on plan:** Required for correct operation. Without fix, every QR request caused a TypeError and 500 response. Fix preserves all plan intent (T-03-06 mitigated, streaming preserved).

## Verification Results

Automated tests against live server (worktree with confirmed ticket in DB):
- `curl /ticket/00000000.../qr.png` -> 404: PASS
- `curl /ticket/{confirmed-uuid}/qr.png` -> 200, PNG image data (300x300): PASS
- Content-Type: image/png: PASS
- Content-Disposition: attachment; filename="ticket-{uuid}.png": PASS
- Module load (node -e require(...)): PASS

## Issues Encountered

- The worktree does not have node_modules installed (worktrees share source but not node_modules). Created a temporary symlink to the main repo's node_modules for testing, removed after verification.
- Worktree has a separate dev.sqlite with no seed data. Populated it programmatically for testing.

## Checkpoint: Task 2 - Human Verification

**Type:** human-verify
**Gate:** blocking
**Result:** APPROVED

Human-verified checks (all passed):
1. Confirmation page at /ticket/:uuid renders with QR image
2. QR code scans on a real device and encodes the correct full URL
3. Download link saves a PNG file named ticket-{uuid}.png

## Known Stubs

None. The /qr.png endpoint is fully functional.

## Threat Flags

None — no new security surface beyond the plan's threat model.

## Next Phase Readiness

- GET /ticket/:uuid/qr.png is fully implemented and tested
- Full confirmation flow (pending -> /ticket/:uuid -> QR display -> download) is complete
- Phase 4 scanner can read the QR URL (full navigable URL encoded, not bare UUID)
- Human verification checkpoint cleared (approved)

---
*Phase: 03-confirmation-qr*
*Completed: 2026-05-20*
