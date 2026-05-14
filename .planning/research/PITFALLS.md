# Pitfalls Research — Event Ticketing

**Project:** Powder Rhythm Ticketing
**Domain:** Node.js + Square Checkout Links + Railway/Postgres
**Researched:** 2026-05-14
**Overall confidence:** HIGH — all critical pitfalls verified against official Square docs, Railway community, and library issue trackers

---

## Square Webhook Pitfalls

### 1. Duplicate Events Are Normal and Will Bite You

**What goes wrong:** Square fires `payment.updated` multiple times for the same payment, sometimes 3 rapid pings within a single second, all with `status: COMPLETED`. Without idempotency handling, your system creates multiple ticket records for a single purchase.

**Root cause:** Square's delivery guarantee is at-least-once, not exactly-once. Retries also fire if your endpoint doesn't respond with a 2xx within ~10 seconds.

**Consequences:** Duplicate tickets in DB, capacity count inflated, buyer gets confused confirmation page behavior.

**Prevention:**
- Store `event_id` from every processed webhook in the DB (or a fast cache).
- Before processing, query: `SELECT 1 FROM processed_events WHERE event_id = $1`. If found, return 200 immediately and do nothing.
- Use a DB unique constraint on `payment_id` in the tickets table as a hard backstop — even if idempotency check is bypassed, the INSERT will fail safely.

**Detection:** Watch your logs for multiple webhook calls within the same second sharing a `payment_id`.

---

### 2. Retry Behavior Creates a Silent 24-Hour Window

**What goes wrong:** Square retries failed webhook deliveries for up to 24 hours using exponential backoff (1 min, 2 min, 4 min...). A temporary Railway restart or cold-start that takes 11+ seconds to respond will trigger retries. Your endpoint comes back up, retries arrive, and tickets get created — but the buyer has long since assumed payment failed and may have tried again.

**Prevention:**
- Respond with 200 immediately on receipt, then process asynchronously (or just process fast — webhook handling should be <500ms with a simple INSERT).
- Implement idempotency (see Pitfall 1) so retries arriving later are safely ignored.
- Retried requests include `square-retry-number` and `square-retry-reason` headers — log these for diagnostics.

---

### 3. Wrong Webhook Event for Payment Links

**What goes wrong:** Developers subscribe to `order.updated` alone and miss payment state, or subscribe to `payment.created` and fire before payment is actually captured.

**The right event:** For Square Checkout Links (redirect flow), subscribe to `payment.updated` and process only when `payment.data.object.payment.status === "COMPLETED"`. This is the canonical signal that money has been captured.

**Secondary event:** `order.updated` fires too but does not reliably indicate captured payment without checking the full order's payment collection status. Use `payment.updated` as the trigger.

---

### 4. Signature Verification Is Mandatory and Easy to Break

**What goes wrong:** The HMAC-SHA256 signature check passes in development but fails silently in production, or vice versa — leaving you either accepting forged requests or rejecting legitimate ones.

**Critical details:**
- Square signs using: `HMAC-SHA256(signatureKey, notificationURL + rawBody)`
- The notification URL in the signature calculation must match the URL registered in the Square Developer Console **exactly** — including scheme, port, trailing slash. A mismatch causes every legitimate request to fail verification.
- Express's `express.json()` middleware parses and re-serializes the body. Even a single whitespace difference causes the HMAC to not match. **Capture the raw buffer before any middleware parses it.**
- Never compare signatures with `===`. Use `crypto.timingSafeEqual()` to prevent timing-attack vulnerability.

**Implementation pattern:**
```js
app.use('/webhooks/square', express.raw({ type: 'application/json' }), squareWebhookHandler);
// All other routes get express.json() normally
```

---

### 5. Webhook Not Firing in Sandbox (Redirect URL Parameters Missing)

**What goes wrong:** In sandbox, Square does NOT append `orderId`, `transactionId`, `checkoutId`, or `referenceId` query parameters to the redirect URL. If your confirmation page logic reads these from the URL to display the ticket, it will break in sandbox — then appear to work in production without having actually been tested.

**The real story:** In production, Square appends these parameters. In sandbox they are absent or unreliable.

**Prevention:** Never rely solely on redirect URL parameters to identify the order. Instead, store a `reference_id` (your internal ticket token) when creating the payment link, and embed it in the redirect URL yourself: `redirect_url: https://tickets.powderrhythm.com/confirm?ref=<your_token>`. Your confirmation endpoint then looks up the ticket by that token — independent of what Square appends.

---

## Buyer Recovery Scenarios

### 1. Buyer Pays and Never Returns to Confirmation Page

**What goes wrong:** The buyer closes the Square checkout tab, loses connection, or just navigates away. The webhook fires and the ticket record is created — but the buyer never saw the QR code and didn't screenshot it. With no email delivery and no account, they have no way to retrieve it.

**This is the highest-risk gap in this project's MVP design (no email, no account).**

**Consequences:** Angry buyer at the door with no QR code, requiring manual admin lookup on the night of the event.

**Prevention options (ranked by build cost):**

| Option | Cost | How |
|--------|------|-----|
| Stable retrieve URL | Very low | `GET /ticket/:token` — buyer bookmarks or shares link. Token is UUID stored in DB. Make the confirmation page URL the source of truth, not just the landing page. |
| Link in Square receipt | None | Square sends its own payment receipt email by default with the order number. Consider whether the confirmation URL can be constructed from that. |
| Email via Resend | Medium | Add `Resend` (free tier: 3k emails/month) — send QR code link in a transactional email. Buyer provides email at checkout via Square's built-in "ask for buyer email" option on payment links. |

**For the May 29 launch:** Implement the stable retrieve URL (`/ticket/:token`) immediately. This is low-effort and ensures every buyer can return to their QR code at any time from any device if they have the URL. Log the token in the Square `reference_id` field when creating the payment link so it can be recovered from the Square dashboard in a worst case.

---

### 2. Buyer's Browser Crashes Mid-Redirect

**What goes wrong:** Payment completes, Square fires webhook (ticket created), redirect back to your server begins — buyer's browser or phone crashes. They lose the confirmation URL.

**Prevention:** Same as above — stable retrieve URL. The webhook has already created the ticket; the QR code exists. They just need to get back to it.

---

### 3. Capacity Check Race Condition

**What goes wrong:** Two buyers simultaneously reach the final click in Square checkout for the last available ticket. Both webhooks arrive within milliseconds. Both tickets get created. Event is now over capacity.

**Prevention:** Enforce capacity at the database level, not in application logic:
```sql
-- Tickets table
CHECK (total_tickets_for_event <= max_capacity)
```
Or use a transaction with a count check before INSERT. The application-layer "seats remaining" display is advisory; the DB constraint is authoritative. For a small venue (Baker City gig, likely <200 capacity), over-sells of 1-2 are manageable — but worth getting right.

---

## Day-of Door Failures

### 1. Phone Dies or Battery Critical

**Most likely failure.** The buyer's phone is at 3% after a long day. They can't load the confirmation page.

**Prevention:**
- Admin page has full attendee list with name + email. Staff can look up by name and manually check in.
- Build the admin check-in as a simple name search with a "Mark as Checked In" button. This is listed as a requirement and must be reliable.
- Have a portable battery pack at the door for loan.

---

### 2. QR Code Won't Scan — Lighting

**What goes wrong:** Venue is dim (music venue = low light). The `html5-qrcode` camera feed is noisy in low light. Scanner struggles to distinguish the pattern.

**Prevention:**
- Instruct buyers to maximize screen brightness before arrival.
- Staff scanner page should default to full brightness (CSS `screen.orientation` API) or show a reminder.
- Test the scanner in the actual venue lighting before doors open.
- Fallback: manual name lookup removes the QR scan as a hard dependency.

---

### 3. html5-qrcode Black Screen on iOS Safari

**Confirmed reported bug** in html5-qrcode (GitHub issues #332, #890, #713): On iOS 17.x Safari, the camera feed sometimes shows a black screen after permission is granted. Scanning still works (results appear in console) but the visual feedback is gone, which confuses staff.

**Prevention:**
- Test the scanner page on an actual iPhone in Safari before the event.
- If black screen occurs, reload the page — this clears the state.
- Fallback: the manual admin check-in list is the backstop.
- Consider whether the door-scanning phone is Android. If so, this bug is avoided.

---

### 4. Camera Permission Denied / Forgotten

**What goes wrong:** Staff opens the scanner page, browser asks for camera permission, staff taps "Block" by accident or permission was previously blocked. Scanner shows a permission error.

**Prevention:**
- Document the permission grant flow in a single-page "door guide" printed/saved before the event.
- Test on each scanning device ahead of time so permissions are already granted.
- On iOS Safari, permissions reset per session — staff will need to grant on each new scanner page load.

---

### 5. QR Code Already Scanned (Duplicate Entry Attempt)

**What goes wrong:** Someone screenshots a friend's QR code. Or a buyer shows the same ticket twice at different entrances.

**Prevention:**
- Mark ticket as `used_at: timestamp` on first scan. Return 200 with `{status: "valid"}`.
- On second scan, return `{status: "already_used", used_at: ...}`. Display red, show time of prior scan.
- This is listed as a requirement and is correct.

---

### 6. QR Code Not Found

**What goes wrong:** Scanner returns "not found" for a genuine ticket. Causes: buyer has the wrong venue, wrong event QR code; DB lookup bug; token corruption in URL.

**Prevention:**
- Log every scan attempt (token scanned, timestamp, result) for post-event audit.
- Admin can search by name as immediate fallback.
- QR code should encode a URL (not a bare token) — e.g., `https://tickets.powderrhythm.com/scan?t=<token>` — so that even if the scanning app fails, a phone camera pointing at the code can open the browser to a human-readable page.

---

## Sandbox vs Production Gotchas

### 1. Separate API Keys — Wrong Key = Silent Auth Failure

Square provides **separate credentials** for sandbox and production. Using the wrong one returns `AUTHENTICATION_ERROR / UNAUTHORIZED`. This is easy to do when copy-pasting `.env` values.

**Prevention:**
- Name env vars explicitly: `SQUARE_ACCESS_TOKEN_SANDBOX`, `SQUARE_ACCESS_TOKEN_PROD`, and select via `NODE_ENV`.
- Better: Railway manages env vars per environment (production service vs staging). Never put production keys in development `.env`.

---

### 2. Separate Webhook Subscriptions Per Environment

Sandbox webhooks and production webhooks are **independent subscriptions** in the Developer Console. You must configure your webhook URL once for sandbox and once for production. There is no "promote to production" button.

**What goes wrong:** Developer sets up sandbox webhook pointing to Railway production URL, or forgets to register the production webhook entirely before the event.

**Prevention:**
- Create both webhook subscriptions during initial setup (day one).
- Verify with a test event in production at least 72 hours before the event.
- The `square-environment` header on incoming webhooks is either `Production` or `Sandbox` — log it and reject if it doesn't match `NODE_ENV`.

---

### 3. Redirect URL Parameters Not Present in Sandbox

As noted above: sandbox does not reliably append `orderId`, `transactionId`, etc. to redirect URLs. This means redirect-based order lookup logic that works in production **appears broken in sandbox** (or vice versa if you hardcode around it).

**Prevention:** Design the confirmation page flow using your own `reference_id` token embedded in the redirect URL, not Square's appended parameters. Test both flows.

---

### 4. Different Base URLs

- Production: `https://connect.squareup.com/v2`
- Sandbox: `https://connect.squareupsandbox.com/v2`

The Square Node.js SDK handles this automatically when initialized with the correct environment enum (`Environment.Production` vs `Environment.Sandbox`). Do not hardcode the base URL string.

---

### 5. Sandbox Checkout UI Differences

In sandbox, the Square checkout page uses test card numbers (4111 1111 1111 1111 etc.) and **does not accept real cards**. Sandbox webhook behavior can differ subtly — e.g., the timing of `payment.updated` events may be faster or batched differently than production. Run at least one full end-to-end test with a **real production payment** ($0.01 if needed) before the event.

---

## Railway/Postgres Issues

### 1. SSL Required — rejectUnauthorized Must Be Set

**What goes wrong:** `new Pool({ connectionString: process.env.DATABASE_URL })` without SSL config throws `SSL connection is required` in production. Adding `?sslmode=require` to the connection string alone is not sufficient for Railway's self-signed cert — you also need `rejectUnauthorized: false` in the config object.

**Correct pattern:**
```js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
```

**Critical:** Do not put SSL parameters (`sslcert`, `sslmode`, `sslrootcert`) in the connection string AND in the config object simultaneously — the string-based options override and discard the config object options.

---

### 2. Connection Pool Exhaustion on Railway Free Tier

**What goes wrong:** Railway's managed Postgres defaults to 100 max connections. Express with default pool settings can open many connections during traffic spikes. Serverless or parallel requests exhaust the pool, causing `connection timeout` errors.

**Prevention:**
- Set an explicit, conservative pool size: `max: 5` for a small-event ticketing system. You don't need 20 connections for <200 attendees.
- Set `idleTimeoutMillis: 30000` and `connectionTimeoutMillis: 5000`.
- If exhaustion occurs in production: Railway offers a one-click PgBouncer template. Add it in front of Postgres, change port from 5432 to 6432 in the connection string.

---

### 3. DATABASE_URL vs DATABASE_PUBLIC_URL

Railway provides **two connection strings**:
- `DATABASE_URL` — internal Railway network (fast, for service-to-service)
- `DATABASE_PUBLIC_URL` — public internet (for local dev access or external connections)

Your deployed Express app should use `DATABASE_URL` (internal). Using `DATABASE_PUBLIC_URL` in production adds unnecessary latency and may behave differently with SSL.

---

### 4. SQLite Boolean / Integer Type Drift

**What goes wrong:** SQLite stores booleans as `0`/`1` integers. Postgres has a native `BOOLEAN` type. Knex schema definitions using `.boolean()` produce different column types per dialect. Application code comparing `WHERE scanned = 1` breaks on Postgres.

**Prevention:**
- Use `WHERE scanned = true` in all queries (Knex handles the dialect difference if you use Knex query builder, not raw SQL).
- If using raw SQL anywhere, use `= TRUE` / `= FALSE`.
- Test Postgres behavior locally with Docker before relying on Railway: `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:15`.

---

### 5. Railway Cold Starts and Webhook Timing

**What goes wrong:** Railway's free tier (and some paid tiers) may sleep idle services. A cold start can take 10-15 seconds. Square's webhook timeout is ~10 seconds. If the cold start exceeds the timeout, Square marks delivery as failed and begins retries.

**Prevention:**
- Keep the service warm with a health-check endpoint (`GET /health` returning 200).
- Railway's "sleep" behavior is configurable on paid plans. For the May 29 event, ensure the service is on a plan that does not sleep.
- Implement idempotency (Pitfall 1) so retries are harmless.

---

## What Organizers Regret

### 1. No Way to Reach Buyers After Purchase

**The #1 regret:** Something changes (venue change, set time shift, cancelation) and there's no way to notify ticket holders. With no email and no accounts, buyers are unreachable.

**For May 29:** Square's payment link can request buyer email — enable this. Store the email in the ticket record. Even if you don't send automated email for the MVP, you'll have the list in the admin panel to do a manual Mailchimp blast if needed.

---

### 2. No Tested Fallback for Door Failures

**What organizers report:** "The app glitched at the door and we didn't know what to do." Staff are not developers. If the scanner fails, they need a non-technical fallback they can execute under pressure.

**For May 29:** Print the attendee list (PDF from admin page) before doors open. Worst case, the door is pen-and-paper with the printed list.

---

### 3. Capacity Not Shown Anywhere Buyers Can See

**What goes wrong:** Buyers are unsure if tickets are available. Some buy 2x thinking the first failed. Others don't buy assuming sold out.

**Requirement already captured:** "Capacity is tracked and displayed on the event page (seats remaining)." Ship this for launch. Showing "12 spots left" creates urgency and reduces double-purchases.

---

### 4. Checkout Flow Not Tested on Mobile

**Most ticket purchases happen on phones.** Square Checkout is mobile-optimized, but the redirect flow, confirmation page, and QR display must all be tested on real phones (iOS Safari, Android Chrome) before launch.

**For May 29:** Full mobile end-to-end test is a launch blocker. Do it with a real $1 production charge if necessary.

---

### 5. No Monitoring or Alerting

**What goes wrong:** Webhook silently stops processing (e.g., bad deploy, SSL cert issue, DB connection drop). Tickets aren't being created. Organizer finds out when the first buyer shows up with no QR code.

**For May 29:** Add a simple alert:
- Log webhook receipts and ticket creations.
- Set up Railway's built-in alerting for service crashes.
- Check the admin panel the morning of the event to confirm ticket count matches Square dashboard sales.

---

### 6. Square Dashboard Reconciliation Not Planned

**What goes wrong:** Payment appears in Square but no ticket in the system (webhook failed). Organizer has no way to manually recover before the event.

**Prevention:** Admin panel must support manual check-in by name. This is already a requirement. Additionally: build a simple "import from Square order" recovery path, or document the manual DB insert procedure so a developer can run it in under 5 minutes.

---

## Prevention Strategies

| Pitfall | Mitigation | Priority |
|---------|-----------|----------|
| Duplicate webhook events | Idempotency: store `event_id`, unique constraint on `payment_id` | Critical — ship day 1 |
| Webhook signature bypass | Validate `x-square-hmacsha256-signature` with raw body, `timingSafeEqual` | Critical — ship day 1 |
| Buyer loses QR code | Stable `/ticket/:token` retrieve URL, token embedded in redirect URL | Critical — ship day 1 |
| Wrong webhook event | Subscribe to `payment.updated`, filter `status === "COMPLETED"` | Critical — ship day 1 |
| Railway SSL error | `ssl: { rejectUnauthorized: false }` when `NODE_ENV === production` | Critical — first deploy |
| Sandbox redirect params missing | Use own `reference_id` token in redirect URL, not Square's params | High |
| SQLite/Postgres boolean drift | Use Knex query builder, avoid raw SQL for boolean comparisons | High |
| html5-qrcode iOS black screen | Test on iPhone before event, document reload fix for staff | High |
| Cold start webhook timeout | Health-check endpoint, no-sleep Railway plan for event day | High |
| No buyer contact info | Enable email collection on Square payment link | High |
| Door failure no fallback | Print attendee list before event, admin manual check-in | High |
| Pool exhaustion | `max: 5` pool size, `connectionTimeoutMillis: 5000` | Medium |
| Over-capacity race | DB unique/check constraint on capacity, not just app-layer check | Medium |
| Production webhook not registered | Register both sandbox + production webhooks on day one | Medium |
| Mobile not tested | Full end-to-end on iOS Safari + Android Chrome before launch | Launch blocker |

---

## Sources

- Square Webhooks overview: https://developer.squareup.com/docs/webhooks/overview
- Square Payments API Webhooks: https://developer.squareup.com/docs/payments-api/webhooks
- Square Move to Production (webhooks): https://developer.squareup.com/docs/webhooks/movetoprod
- Square Webhook Signature Validation: https://developer.squareup.com/docs/webhooks/step3validate
- Square Dev Forum — Duplicate webhook on Terminal Checkout: https://developer.squareup.com/forums/t/terminal-checkout-webhook-duplicate/6986
- Square Dev Forum — payment.updated triggers 2 responses: https://developer.squareup.com/forums/t/webhook-payment-updated-triggers-2-responses/10871
- Square Dev Forum — Sandbox redirect URL params not added: https://developer.squareup.com/forums/t/square-parameters-are-not-being-added-to-checkout-redirect-url/20871
- Square Dev Forum — OrderId in sandbox payment link: https://developer.squareup.com/forums/t/grabbing-the-orderid-parameter-from-a-sandbox-create-payment-link-flow/18635
- Railway Blog — Database Connection Pooling: https://blog.railway.com/p/database-connection-pooling
- Railway Help — Unable to connect Postgres SSL: https://station.railway.com/questions/unable-to-connect-to-railway-postgres-fr-03e6edff
- Railway — Deploy Postgres + PgBouncer: https://railway.com/deploy/postgres-pgbouncer
- node-postgres SSL docs: https://node-postgres.com/features/ssl
- html5-qrcode iOS Safari black screen issue #890: https://github.com/mebjas/html5-qrcode/issues/890
- html5-qrcode iOS camera permission issue #332: https://github.com/mebjas/html5-qrcode/issues/332
- QR Code scanning problems guide: https://www.qr-code-generator.com/blog/qr-code-scanning-problems-and-solutions/
- Knex + Postgres boolean migration: https://medium.com/building-proposales/knex-migration-bookshelf-orm-postgresql-and-boolean-13f3d7b602cc
- Event ticketing mistakes guide: https://www.hytix.com/blog/10-event-ticketing-mistakes-event-organizers-should-avoid/
- First-time organizer mistakes: https://bookitbee.com/5-mistakes-first-time-event-organizers-make-and-how-the-right-ticketing-platform-can-save-you/
