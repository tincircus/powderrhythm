---
status: complete
phase: 04-door-scanner
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-05-21T03:50:00Z
updated: 2026-05-21T04:10:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. From ticketing/ run: ADMIN_PASSWORD=testpass node index.js — server boots without errors, prints the listening port, and responds to a basic request.
result: pass

### 2. Unauthenticated scan page redirects to login
expected: GET http://localhost:3000/scan (without a cookie, e.g. in a fresh browser tab or with curl -L) returns the login page — HTML containing "Scanner Login" as the page heading.
result: pass

### 3. Login form — wrong password shows error
expected: Submit the login form (or curl -X POST -d "password=wrong" http://localhost:3000/scan/login) with a wrong password. The page re-renders showing "Wrong password. Try again." No cookie is set.
result: pass

### 4. Login form — correct password grants access
expected: Submit the form (or curl) with the correct ADMIN_PASSWORD. Response redirects to /scan and sets a scan_auth cookie (HttpOnly; SameSite=Strict). No error message.
result: pass

### 5. Scanner page loads after login
expected: GET http://localhost:3000/scan with the valid cookie renders the full-viewport camera page — dark background, aim-guide frame overlay, "Hold QR code inside the frame" status bar at the bottom. The qr-scanner script from jsDelivr CDN is requested by the browser.
result: pass

### 6. Search fallback is visible but collapsed
expected: On the /scan page, the "Can't scan? Search by name" <details> toggle is visible at the bottom of the screen but collapsed by default. Clicking it expands a text input field.
result: pass

### 7. API — no-cookie request returns 401 JSON
expected: curl -s -X POST -H "Content-Type: application/json" -d '{"uuid":"00000000-0000-4000-a000-000000000000"}' http://localhost:3000/api/scan returns JSON { "error": "Unauthorized" } — NOT an HTML redirect page.
result: pass

### 8. API — malformed UUID returns 400 JSON
expected: curl -s -b <cookie-jar> -X POST -H "Content-Type: application/json" -d '{"uuid":"not-valid"}' http://localhost:3000/api/scan returns { "error": "Invalid uuid" } with HTTP 400.
result: pass

### 9. API — unknown UUID returns not_found
expected: Scanning a well-formed UUID that is not in the database returns { "ok": false, "reason": "not_found" } with HTTP 200.
result: pass

### 10. API — valid confirmed ticket returns ok:true
expected: Scanning the UUID of a confirmed ticket (status='confirmed', scanned_at IS NULL) returns { "ok": true, "name": "<buyer name>" } and the tickets.scanned_at column is now set in the DB.
result: pass

### 11. API — scanning same ticket twice returns already_scanned
expected: A second POST to the same UUID (now already scanned) returns { "ok": false, "reason": "already_scanned", "scannedAt": "<timestamp>" }. The original scan_at value is unchanged.
result: pass

### 12. API — search without cookie returns 401 JSON
expected: curl -s "http://localhost:3000/api/scan/search?q=test" (no cookie) returns { "error": "Unauthorized" } JSON — NOT an HTML redirect.
result: pass

### 13. API — empty search query returns empty array
expected: curl -s -b <cookie-jar> "http://localhost:3000/api/scan/search?q=" returns [] (empty JSON array).
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
