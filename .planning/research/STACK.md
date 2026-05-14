# Stack Research — Event Ticketing

**Project:** Powder Rhythm Ticketing  
**Researched:** 2026-05-14  
**Overall Confidence:** HIGH for Square/QR/Railway specifics, MEDIUM for ORM recommendation

---

## Recommended Stack

| Layer | Library | Version | Notes |
|-------|---------|---------|-------|
| HTTP | express | ^4.x | Existing constraint |
| Square payments | square | ^44.0.1 | Latest as of 2026-03-12 |
| QR generation (server) | qrcode | ^1.5.x | Node + browser, PNG/SVG output |
| QR scanning (browser) | qr-scanner | ^1.4.2 | nimiq; actively maintained, WASM-based |
| SQLite driver (dev) | better-sqlite3 | ^9.x | Synchronous, fast, no ORM needed |
| Postgres driver (prod) | pg (node-postgres) | ^8.x | Standard; accepts DATABASE_URL directly |
| Email (deferred) | resend | ^3.x | Already planned; add after core ships |
| Railway deploy | railway.json or package.json scripts | — | No Procfile needed |

---

## Square SDK

### Current Version

**44.0.1** (released 2026-03-12). The SDK underwent a full rewrite at v40.0.0 with breaking changes. If any tutorial or StackOverflow answer predates v40, the client construction and method names will be wrong.

### Client Construction (v40+)

```js
import { SquareClient, SquareEnvironment } from 'square';

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: SquareEnvironment.Sandbox, // or .Production
});
```

The legacy import path (`square/legacy`) still exists for gradual migration but should not be used in new code.

### Creating a Checkout Link

The correct endpoint is `POST /v2/online-checkout/payment-links` via `client.checkout.createPaymentLink(...)`. The old `CreateCheckout` endpoint is deprecated — do not use it.

Minimal request shape:
```js
const { result } = await client.checkout.createPaymentLink({
  idempotencyKey: crypto.randomUUID(),
  quickPay: {
    name: 'GA Ticket — May 29 Show',
    priceMoney: { amount: BigInt(2500), currency: 'USD' }, // cents
    locationId: process.env.SQUARE_LOCATION_ID,
  },
  checkoutOptions: {
    redirectUrl: 'https://tickets.powderrhythm.com/confirm?orderId=...',
    merchantSupportEmail: 'hi@powderrhythm.com',
  },
});
const checkoutUrl = result.paymentLink.url;
```

`priceMoney.amount` is a `BigInt` in v40+. Do not pass a plain number.

The response includes `paymentLink.url` (redirect the buyer here) and `paymentLink.orderId` (store this; the webhook will reference it).

### Webhook Verification

**Header name:** `x-square-hmacsha256-signature` (lowercase, exactly as shown)  
**Algorithm:** HMAC-SHA-256  
**What is signed:** `notificationUrl + rawRequestBody` (concatenated, not hashed separately)

The SDK provides `WebhooksHelper.verifySignature()`:

```js
import { WebhooksHelper } from 'square';

// CRITICAL: must use raw body, not parsed JSON
app.post('/webhooks/square', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-square-hmacsha256-signature'];
  const isValid = WebhooksHelper.verifySignature({
    requestBody: req.body.toString('utf8'), // Buffer from express.raw()
    signatureHeader: signature,
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    notificationUrl: 'https://tickets.powderrhythm.com/webhooks/square',
  });

  if (!isValid) return res.status(400).send('Invalid signature');

  const event = JSON.parse(req.body);
  // handle event.type === 'payment.completed', etc.
  res.sendStatus(200);
});
```

**Do not** apply `express.json()` globally to the webhook route. Use `express.raw()` on that route only, then parse manually after verification. If global `express.json()` runs first, `req.body` will already be a parsed object, the raw bytes are gone, and every signature check will fail.

The `signatureKey` comes from the Square Developer Dashboard under your webhook subscription — it is NOT the same as your access token.

---

## QR Code

### Generation (server-side): `qrcode`

Use the `qrcode` npm package. It is the dominant choice for server-side Node.js QR generation, supports PNG and SVG output, runs in both Node and browser, and is actively maintained.

```js
import QRCode from 'qrcode';

// Returns a data URL (embed directly in <img src="">)
const dataUrl = await QRCode.toDataURL(ticketToken, {
  errorCorrectionLevel: 'H', // higher tolerance for dirty/printed codes
  width: 300,
});

// Or write a PNG buffer for file/email attachment
const pngBuffer = await QRCode.toBuffer(ticketToken, { type: 'png' });
```

Embed the `dataUrl` in the confirmation page HTML. Buyers can screenshot or use "Save Image As" — no download endpoint required unless you want a dedicated one.

The value to encode should be your ticket token/UUID, not the full confirmation URL. The scanner only needs a unique identifier; keep it short.

### Scanning (browser): `qr-scanner`

Use **`qr-scanner`** by nimiq (not `html5-qrcode`).

**Why not `html5-qrcode`:** The mebjas library is unmaintained. It wraps ZXing.js, which is itself in maintenance mode. Last meaningful release was years ago.

**Why `qr-scanner`:** Actively maintained by nimiq (blockchain company with production use). Uses a WASM-compiled version of ZXing under the hood but wraps it with a clean modern API. ~103K weekly downloads. Works directly from a `<video>` element — no framework required, which fits the vanilla phone-browser scanner page.

```html
<script type="module">
  import QrScanner from '/vendor/qr-scanner.min.js';

  const scanner = new QrScanner(
    document.getElementById('video'),
    result => handleScan(result.data),
    { returnDetailedScanResult: true }
  );
  scanner.start();
</script>
```

Ship the WASM worker file alongside the JS — `qr-scanner` requires `qr-scanner-worker.min.js` to be accessible at the same path as the main script (or configure `workerPath` explicitly).

**jsQR** is an alternative but development is dormant. Avoid for new projects.

---

## Database

### Recommendation: Two separate drivers, no ORM

For this project (simple schema: events, tickets, scans — maybe 4-5 tables total, no complex joins), a full ORM is unnecessary overhead. Use:

- **Dev (SQLite):** `better-sqlite3` — synchronous API, significantly faster than `sqlite3` async, excellent DX for simple CRUD
- **Prod (Postgres):** `pg` (node-postgres) — standard driver, accepts `DATABASE_URL` directly from Railway's injected env var

Wrap both behind a thin `db.js` module that exports the same interface (parameterized query function). Switch on `NODE_ENV`. This keeps the abstraction layer to ~30 lines of code and avoids Prisma's complexity for a project of this size.

**Why not Prisma:** Prisma is a good choice at scale, but adds ~1.6MB (Rust-free v6.16+) or ~14MB (older) to the bundle, requires a schema file and migration workflow, and is meaningfully slower than raw drivers for simple queries. The ticket schema here is stable and small — migrations can be plain SQL files. Prisma's value (TypeScript type safety, complex relation queries) doesn't pay off at this scale.

**Why not the `sqlite3` package:** It is async and slower than `better-sqlite3` with no real upside for a synchronous Node.js server context. `better-sqlite3` is the current community standard for SQLite in Node.

**Schema migration approach:** Plain `.sql` files in a `migrations/` directory, applied at startup with a simple `runMigrations()` function. No migration framework needed at 4-5 tables.

```js
// db.js (simplified)
import Database from 'better-sqlite3';
import pg from 'pg';

const isProd = process.env.NODE_ENV === 'production';

export const db = isProd
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Database('./dev.db');

export function query(sql, params) {
  return isProd
    ? db.query(sql, params).then(r => r.rows)
    : db.prepare(sql).all(params);
}
```

---

## Hosting (Railway)

### Deployment

Railway auto-detects Node.js via Railpack (their Nixpacks fork). No Procfile needed. The `start` script in `package.json` is used automatically:

```json
{
  "scripts": {
    "start": "node ticketing/server.js"
  }
}
```

If the ticketing app is in a `/ticketing` subfolder of the main repo, set the **Root Directory** to `ticketing` in the Railway service settings, OR use the full path in the start script from the repo root.

### Environment Variables

Railway injects these automatically when you add a Postgres plugin to the project:

- `DATABASE_URL` — full connection string (use this in `pg.Pool`)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — individual parts (rarely needed)

For SSL on Railway Postgres, add `ssl: { rejectUnauthorized: false }` to your `pg.Pool` config. Railway uses self-signed certs internally.

You must set manually:
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_LOCATION_ID`
- `ADMIN_PASSWORD`
- `NODE_ENV=production`

### Migration Timing

Run database migrations at startup, before the HTTP server begins accepting connections. Railway does not support pre-deploy hooks on the free tier. Pattern:

```js
await runMigrations();  // apply SQL migration files
app.listen(process.env.PORT || 3000);
```

Railway injects `PORT` — always use `process.env.PORT` as the listen port, not a hardcoded value.

### Webhook Accessibility

Railway services get a public HTTPS URL by default (e.g., `https://ticketing-production.up.railway.app`). Use this as your Square webhook notification URL. The URL must be HTTPS — Square will not deliver to HTTP endpoints.

### Gotchas

- **Private network during build:** `DATABASE_URL` is not available at build time on Railway — only at runtime. Do not connect to the DB in module-level initialization code that runs during `npm install` or build scripts.
- **Free tier sleep:** Railway's free tier sleeps inactive services. Webhooks arriving while asleep may be missed. Use the Hobby plan ($5/month) for a production event.
- **Subfolder deploys:** If deploying the ticketing subfolder as a separate Railway service from the same repo, set the Root Directory correctly in the Railway service settings — Railway supports monorepo patterns via this config.

---

## What NOT to Use

| Library / Approach | Avoid Because |
|---|---|
| `html5-qrcode` (mebjas) | Unmaintained; wraps ZXing which is also in maintenance mode |
| `jsQR` | Development dormant as of recent review |
| `sqlite3` (npm) | Async, slower than `better-sqlite3`, no advantage for this use case |
| `square/legacy` import path | Deprecated compatibility shim; use `square` directly with v40+ API |
| Old `CreateCheckout` endpoint | Deprecated by Square; `createPaymentLink` is the correct current API |
| `express.json()` globally on webhook route | Destroys raw body needed for signature verification; scope it correctly |
| Prisma | Appropriate at scale; unjustified overhead for a 4-5 table schema |
| Hardcoded `PORT` | Railway injects `PORT` env var; hardcoding will break deployment |
| BigInt-as-number for Square amounts | SDK v40+ requires `BigInt()` for `priceMoney.amount`; plain numbers will fail |

---

## Confidence Levels

| Area | Confidence | Basis |
|---|---|---|
| Square SDK version (44.0.1) | HIGH | GitHub releases page, confirmed March 2026 |
| Square Checkout Links API pattern | HIGH | Official Square API Reference, SDK README |
| Webhook header name + HMAC method | HIGH | Official Square docs (developer.squareup.com/docs/webhooks/step3validate) |
| WebhooksHelper.verifySignature() existence | HIGH | Confirmed in Square SDK docs and forum discussions |
| Raw body requirement for webhook verification | HIGH | Multiple official and community sources agree |
| `qrcode` npm for server-side generation | HIGH | Dominant library, actively maintained, broad documentation |
| `html5-qrcode` being unmaintained | HIGH | Multiple comparison sources confirm; GitHub releases confirm stale state |
| `qr-scanner` (nimiq) as replacement | MEDIUM | ~103K weekly downloads, nimiq maintains it, last release was v1.4.2 "3 years ago" per one source but listed as actively maintained by others — verify before pinning |
| `better-sqlite3` for dev SQLite | HIGH | Community standard, benchmark-backed |
| `pg` for prod Postgres | HIGH | Industry standard for Node.js Postgres |
| "No ORM" recommendation | MEDIUM | Appropriate for this schema size, but Prisma v6.16+ Rust-free is genuinely much lighter now if TypeScript types are preferred |
| Railway auto-detect Node.js via Railpack | HIGH | Official Railway Express deploy guide confirms |
| Railway PORT env var injection | HIGH | Standard Railway behavior, documented |
| Railway SSL self-signed cert requirement | MEDIUM | Consistent across community reports; verify with Railway docs at deploy time |

---

## Sources

- [Square Node.js SDK GitHub Releases](https://github.com/square/square-nodejs-sdk/releases)
- [Square Node.js SDK — Official Docs](https://developer.squareup.com/docs/sdks/nodejs)
- [Square Node.js SDK Migration Guide (v40)](https://developer.squareup.com/docs/sdks/nodejs/migration)
- [Square Create Payment Link — API Reference](https://developer.squareup.com/reference/square/checkout-api/create-payment-link)
- [Square Webhook Verification — Official Docs](https://developer.squareup.com/docs/webhooks/step3validate)
- [qrcode — npm](https://www.npmjs.com/package/qrcode)
- [qr-scanner (nimiq) — GitHub](https://github.com/nimiq/qr-scanner)
- [Railway Express Deploy Guide](https://docs.railway.com/guides/express)
- [Railway Build Configuration](https://docs.railway.com/builds/build-configuration)
- [Prisma v6.16 Rust-free GA](https://www.prisma.io/blog/rust-free-prisma-orm-is-ready-for-production)
- [better-sqlite3 vs prisma vs sqlite — npm trends](https://npmtrends.com/better-sqlite3-vs-prisma-vs-sqlite-vs-sqlite3)
