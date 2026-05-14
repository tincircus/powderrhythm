# Architecture Research — Event Ticketing

**Project:** Powder Rhythm Ticketing
**Researched:** 2026-05-14
**Confidence:** MEDIUM-HIGH (Square-specific claims from forum posts and docs overview; core Node.js/Postgres patterns HIGH)

---

## Component Map

```
Browser (buyer)
  └─► GET /events/:id          → event page (static-ish HTML, seats remaining)
  └─► POST /checkout           → server creates Square payment link, redirects buyer
  └─► Square Checkout (hosted) → buyer pays
  └─► GET /ticket/:uuid        → confirmation page with QR code (served after webhook fires)

Square
  └─► POST /webhooks/square    → payment.updated (status=COMPLETED) fires here

Browser (door scanner)
  └─► GET /scan                → scanner page (html password wall → html5-qrcode UI)
  └─► POST /api/scan           → marks ticket used, returns {valid, name, alreadyScanned}

Browser (admin)
  └─► GET /admin               → password wall → attendee list
  └─► POST /api/admin/checkin  → manual check-in by ticket UUID
```

### Service Boundaries

| Component | Responsibility | Notes |
|-----------|---------------|-------|
| Express server | All HTTP — API + static assets | Single process on Railway |
| Square Checkout | Payment collection, PCI scope | Hosted by Square, redirect-based |
| Square Webhooks | Push notification on payment completion | Delivers to `/webhooks/square` |
| SQLite (dev) / Postgres (prod) | Tickets and events persistence | Railway managed Postgres in prod |
| `public/` directory | Scanner page, admin page, confirmation HTML | Served via `express.static` |

---

## Critical Implementation Details

### 1. Webhook Body Parsing — The One Rule You Cannot Break

Square computes its HMAC-SHA256 signature over the **raw request bytes** before any parsing. If Express parses the body first and you re-serialize it, the bytes will differ and verification will always fail.

**Correct approach — route-level `express.raw()` before global JSON parser:**

```js
// Global JSON parser for all other routes
app.use(express.json());

// Webhook route gets raw buffer INSTEAD — must be registered before express.json()
// or use express.raw() directly on the route
app.post(
  '/webhooks/square',
  express.raw({ type: 'application/json' }),  // body is a Buffer, not parsed object
  squareWebhookHandler
);
```

Inside `squareWebhookHandler`:
```js
const rawBody = req.body.toString('utf8');       // Buffer → string
const signature = req.headers['x-square-hmacsha256-signature'];
const notificationUrl = process.env.SQUARE_WEBHOOK_URL; // full URL Square posts to

// Square's algorithm: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
const hmac = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
hmac.update(notificationUrl + rawBody);
const expected = hmac.digest('base64');

// Use timingSafeEqual to prevent timing attacks
const valid = crypto.timingSafeEqual(
  Buffer.from(signature, 'base64'),
  Buffer.from(expected, 'base64')
);
if (!valid) return res.status(403).end();

const event = JSON.parse(rawBody);
// proceed...
```

**Why `express.raw()` on the route rather than the `verify` callback on `express.json()`:**
The `verify` option on `express.json()` works but requires URL-matching inside it to avoid capturing other routes' bodies into a `rawBody` field. The route-level `express.raw()` is cleaner: only the webhook route gets a Buffer; every other route gets parsed JSON as normal.

**Square signature header name:** `x-square-hmacsha256-signature`
**Algorithm:** `HMAC-SHA256(signatureKey, notificationUrl + rawBody)`, base64-encoded
**Confidence:** MEDIUM — confirmed via Square Developer Forum posts and secondary sources; official docs page was unreachable during this research session. Verify against https://developer.squareup.com/docs/webhooks/step3validate before shipping.

### 2. Ticket UUID Design

**Use UUID v4 stored directly in the QR code. Do not use JWT.**

Rationale:
- UUID v4 is 122 bits of cryptographic randomness — brute-force enumeration over HTTPS is not a realistic attack vector for a 200-person venue event
- JWT adds complexity (key management, expiry decisions, offline verification logic) with no practical benefit for a server-validated scan
- The scan endpoint does a database lookup anyway — signed tokens only help for offline verification, which is not a requirement here

**UUID v4 is sufficient because:**
- 2^122 possible values — guessing a valid ticket UUID is computationally infeasible
- The scan endpoint rate-limits and requires the shared password, further reducing enumeration risk
- Duplicate delivery protection (see idempotency below) prevents UUID conflicts

**What goes in the QR code:**
The UUID itself, encoded as the full confirmation URL:
```
https://tickets.powderrhythm.com/ticket/550e8400-e29b-41d4-a716-446655440000
```

This makes the QR code work as a direct link when scanned by any camera app, not just the scanner page. The scanner page POSTs the UUID to `/api/scan` after extracting it.

**Database column:** `uuid TEXT PRIMARY KEY` (or `UUID` in Postgres). Generate with Node's `crypto.randomUUID()` (no package needed, built-in since Node 14.17).

### 3. Scan-Once Race Condition — Atomic UPDATE Pattern

**Use a single atomic `UPDATE ... WHERE ... RETURNING` query. No explicit transaction needed.**

The key insight: in Postgres and SQLite, a single `UPDATE` statement is atomic. If two concurrent scanner requests race to mark the same ticket, only one UPDATE will match the `WHERE scanned_at IS NULL` condition. The "loser" gets zero rows back and knows the ticket was already scanned.

```sql
-- Postgres
UPDATE tickets
SET scanned_at = NOW(), scanner_note = $2
WHERE uuid = $1
  AND scanned_at IS NULL
RETURNING uuid, buyer_name, scanned_at;
```

```js
const result = await db.query(
  `UPDATE tickets SET scanned_at = NOW()
   WHERE uuid = $1 AND scanned_at IS NULL
   RETURNING uuid, buyer_name`,
  [uuid]
);

if (result.rows.length === 0) {
  // Either ticket doesn't exist, OR it was already scanned
  // Fetch to distinguish the two cases
  const check = await db.query('SELECT scanned_at FROM tickets WHERE uuid = $1', [uuid]);
  if (check.rows.length === 0) return res.json({ valid: false, reason: 'not_found' });
  return res.json({ valid: false, reason: 'already_scanned', scanned_at: check.rows[0].scanned_at });
}

return res.json({ valid: true, buyer_name: result.rows[0].buyer_name });
```

**Why this works without explicit locking:** PostgreSQL's row-level update locking means concurrent UPDATEs serialize at the row level. The first writer sets `scanned_at`; subsequent writers find `scanned_at IS NOT NULL` and match zero rows. This is the correct pattern — no `SELECT FOR UPDATE`, no `SERIALIZABLE` isolation, no application-level mutex needed.

**SQLite caveat:** SQLite uses database-level write locking (WAL mode helps but doesn't fully parallelize writes). For this scale (1-2 scanners at a door event), this is a non-issue. The same query pattern works.

### 4. Square Webhook Idempotency

Square retries webhooks if your endpoint doesn't respond with `200 OK` within 10 seconds. A retry would create a duplicate ticket without idempotency protection.

**Pattern:** Check `event_id` (from the webhook body) against a `processed_webhook_events` table before creating a ticket.

```sql
CREATE TABLE processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

```js
// In webhook handler, after signature verification:
const eventId = event.event_id;
try {
  await db.query('INSERT INTO processed_webhook_events (event_id) VALUES ($1)', [eventId]);
} catch (err) {
  if (err.code === '23505') { // unique constraint violation — already processed
    return res.status(200).json({ received: true }); // ack to Square so it stops retrying
  }
  throw err;
}
// Safe to create ticket now — this execution is the first
```

---

## Data Flow

### Purchase → Ticket (happy path)

```
1. Buyer visits GET /events/:id
   - Server queries events table for capacity, returns event page

2. Buyer clicks "Buy Ticket"
   - POST /checkout with event_id
   - Server calls Square Checkout Links API to create payment link
     - Stores order_id from response in a pending_orders table (or in-memory map for MVP)
     - Sets redirect_url to https://tickets.powderrhythm.com/ticket/pending?order_id=...
   - Server 302-redirects buyer to Square checkout URL

3. Buyer completes payment on Square's hosted page
   - Square posts payment.updated (status=COMPLETED) to POST /webhooks/square
   - Square also redirects buyer to the redirect_url with ?orderId=...&transactionId=...

4. Webhook handler (fires in parallel with or before buyer's redirect lands):
   - Verify HMAC signature
   - Check event_id idempotency
   - Extract order_id and payment_id from webhook body
   - Look up buyer name/email: either present in payment object's buyer_email_address
     field, or requires a follow-up GET /v2/orders/{order_id} call
   - Generate crypto.randomUUID() as ticket UUID
   - INSERT into tickets table
   - Respond 200 to Square within 10 seconds

5. Buyer lands on GET /ticket/:uuid (redirect_url resolves here)
   - Server looks up ticket by UUID
   - Renders confirmation page with QR code (UUID encoded as full ticket URL)
   - QR code downloadable as PNG

NOTE: There is a timing gap — the webhook may not have fired yet when the buyer's
redirect lands. Handle this with a polling retry or a pending state page:
- GET /ticket/pending?order_id=... polls the DB every 1.5s for up to 15s
- Once ticket row exists, redirect to /ticket/:uuid
- If not found after 15s, show "Processing..." with support contact
```

### Scan Flow

```
1. Scanner opens GET /scan — password-checked via middleware
2. html5-qrcode reads QR from camera
3. Extracts UUID from scanned URL
4. POST /api/scan { uuid } — password sent as request header or session cookie
5. Atomic UPDATE query
6. Response: { valid: true, buyer_name } → green screen
            { valid: false, reason: 'already_scanned' } → red screen
            { valid: false, reason: 'not_found' } → red screen
```

---

## Security Considerations

### Webhook Verification
- Always verify the Square HMAC signature before trusting any webhook body
- Use `crypto.timingSafeEqual()` for the comparison — standard string comparison leaks timing information
- Reject with 403 if signature invalid; Square will retry, which you handle with idempotency

### Ticket Forgery Prevention
- UUID v4 (122 bits entropy) is not guessable in practice
- The `/ticket/:uuid` confirmation page is publicly accessible by design — possessing the URL is the "ticket"
- Do not expose `/ticket/list` or any route that enumerates UUIDs

### Admin/Scanner Auth
- Simple shared password from `ADMIN_PASSWORD` env var
- Check it in middleware for `/admin` and `/scan` routes, and as a header/body field for `/api/scan` and `/api/admin/*`
- This is appropriate for the scale (1-2 trusted staff, venue-local access)
- Do not use this pattern if the scanner page will be used over an untrusted network — it is fine for a venue's WiFi

### SQL Injection
- Use parameterized queries throughout — never string-interpolate user input into SQL
- The UUID and event_id fields are the primary attack surface

### Rate Limiting
- Add `express-rate-limit` to `/api/scan` — 30 req/min per IP is generous for legitimate scanners
- Prevents UUID enumeration attempts even if someone discovers the endpoint

---

## Build Order

Build in this sequence to enable end-to-end testing at each step:

**Phase 1 — Database and Skeleton**
- Set up `tickets/` directory, `package.json`, Express app skeleton
- Define schema: `events` table, `tickets` table, `processed_webhook_events` table
- Database module with Postgres (prod) / SQLite (dev) switching via `DATABASE_URL` env var
- `GET /health` endpoint returning `{ status: 'ok', timestamp }` — Railway needs this

**Phase 2 — Square Integration**
- `GET /events/:id` — event page with capacity from DB
- `POST /checkout` — creates Square payment link, redirects buyer
- `POST /webhooks/square` — signature verification + idempotent ticket creation
- Pending-state flow: `/ticket/pending?order_id=...` polls until ticket exists

**Phase 3 — Confirmation Page**
- `GET /ticket/:uuid` — serves confirmation page
- QR code generation on the page (client-side via `qrcode` npm package or `<canvas>`)
- Download-as-PNG button

**Phase 4 — Scanner**
- `GET /scan` with password middleware
- QR scanning UI (html5-qrcode or nimiq/qr-scanner — see Gotchas)
- `POST /api/scan` with atomic UPDATE

**Phase 5 — Admin**
- `GET /admin` with password middleware
- Attendee list with scan status
- `POST /api/admin/checkin/:uuid` — manual check-in

**Phase 6 — Production Hardening**
- `helmet()` middleware
- `express-rate-limit` on scan and API routes
- Graceful shutdown handler (SIGTERM)
- Railway Postgres connection via `DATABASE_PRIVATE_URL`

---

## Gotchas

### html5-qrcode is in maintenance mode
The library has had no releases since April 2023 and iOS Safari compatibility issues are actively reported in the GitHub issue tracker (issues #484, #618, #974, #976, #994, #1036 — ongoing as of early 2026). Since the scanner will run on 1-2 personal iPhones, this is a real problem.

**Recommendation:** Use `nimiq/qr-scanner` instead. It is actively maintained, uses a Web Worker for decoding (better performance), and handles iOS Safari camera access more reliably. It wraps the same ZXing decoding engine but with a maintained browser compatibility layer. It also uses the native `BarcodeDetector` API where available (Chrome/Android), which is faster and more accurate.

```bash
npm install qr-scanner
```

Test on an actual iPhone before the event. The camera permission prompt on iOS requires HTTPS — Railway provides this automatically.

### Square redirect arrives before webhook
The buyer's browser lands on your redirect URL almost immediately after payment. The webhook takes 1-5 seconds to arrive. If you serve the confirmation page synchronously from the redirect, the ticket row won't exist yet.

**Solution:** Make the redirect URL a polling page (`/ticket/pending?order_id=...`) that polls `GET /api/ticket-status?order_id=...` every 1.5 seconds until the ticket row appears, then redirects to `/ticket/:uuid`. Cap polling at 15 seconds and show a "still processing" message.

### Square buyer_email_address is not always in the webhook body
Forum posts confirm `buyer_email_address` is sometimes absent from `payment.updated` events when the payment was made via a checkout link. If you need the buyer's name/email for the admin attendee list, you may need to call `GET /v2/orders/{order_id}` from the webhook handler to retrieve the order, which includes the buyer's contact fields from the checkout form.

**Pre-validate:** Create a test checkout in sandbox and log the full webhook body to confirm which fields are present before building the parsing logic around assumed fields.

### Railway: start with `node` directly, not `npm start`
Railway sends `SIGTERM` to the process on deploy/shutdown. If you start via `npm start`, npm intercepts the signal and the Express server never receives it, causing Railway to force-kill after a timeout and potentially drop in-flight requests.

In Railway's service settings, set the start command to:
```
node ticketing/server.js
```
Not `npm start` or `npm run start`.

### Graceful shutdown pattern for Railway
```js
const server = app.listen(PORT, () => console.log(`listening on ${PORT}`));

function shutdown() {
  // Signal health check to return 503 so Railway stops sending traffic
  app.set('shutting_down', true);
  server.close(() => {
    pool.end();     // close Postgres connection pool
    process.exit(0);
  });
  // Force exit if connections don't drain within 10s
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Health check respects shutdown state
app.get('/health', (req, res) => {
  if (app.get('shutting_down')) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'ok' });
});
```

### Use DATABASE_PRIVATE_URL on Railway, not DATABASE_URL
When both the Node service and Postgres are in the same Railway project, `DATABASE_PRIVATE_URL` routes traffic over Railway's internal network (faster, no egress cost). `DATABASE_URL` is the public URL. Set your Postgres pool to use:
```js
process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL
```
This falls back gracefully in local dev.

### express.static ordering matters
Static files should be registered after API routes to prevent a file named `scan.html` in `public/` from shadowing `GET /scan`. Register in this order:
```js
app.use('/health', healthHandler);
app.use('/api', apiRouter);
app.use('/webhooks', webhooksRouter);
app.use(express.static(path.join(__dirname, 'public')));
// Route handlers for pages (events, tickets, scan, admin) after static
```

### Postgres SSL on Railway
Railway Postgres requires SSL. Add `ssl: { rejectUnauthorized: false }` to your pg Pool config, or set the connection string with `?sslmode=require`. Without this, the connection will be refused in production.

```js
const pool = new Pool({
  connectionString: process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

---

## Sources

- Square webhook signature verification: https://developer.squareup.com/docs/webhooks/step3validate (official docs — verify algorithm details here)
- Square webhook idempotency: https://developer.squareup.com/docs/webhooks/step4manage
- Square webhooks overview: https://developer.squareup.com/docs/webhooks/overview
- Square checkout redirect params: https://developer.squareup.com/forums/t/grabbing-the-orderid-parameter-from-a-sandbox-create-payment-link-flow/18635
- buyer_email_address availability: https://developer.squareup.com/forums/t/the-buyer-email-address-and-reference-id-fields-are-not-displayed-in-the-payment-update-event/7495
- PostgreSQL UPDATE atomicity: https://brandur.org/postgres-atomicity
- PostgreSQL RETURNING clause: https://www.postgresql.org/docs/current/dml-returning.html
- html5-qrcode iOS issues: https://github.com/mebjas/html5-qrcode/issues/484
- nimiq/qr-scanner: https://github.com/nimiq/qr-scanner
- Railway SIGTERM handling: https://docs.railway.com/deployments/troubleshooting/nodejs-sigterm-handling
- Railway Postgres connection: https://docs.railway.com/databases/postgresql
- Express health checks and graceful shutdown: https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
- Webhook idempotency implementation: https://hookdeck.com/webhooks/guides/implement-webhook-idempotency
