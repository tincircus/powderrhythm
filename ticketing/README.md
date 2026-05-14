# Powder Rhythm Ticketing

Lightweight event ticketing backend for Powder Rhythm (Baker City, OR). Buyers purchase via Square, get a QR code, and present it at the door. No account required.

Served from `tickets.powderrhythm.com` via Railway.

## Local development

**Requirements:** Node.js 20+, npm

```sh
cd ticketing
npm install
cp .env.example .env
# Edit .env — see "Square sandbox setup" below
npm run dev
```

The server starts at `http://localhost:3000`. SQLite (`dev.sqlite`) is used automatically when `DATABASE_URL` is unset. Migrations run on startup — no manual step needed.

### Square sandbox setup

You need a free Square developer account to test payments locally.

1. Go to [developer.squareup.com](https://developer.squareup.com) → create an application
2. From the **Sandbox** tab, copy:
   - **Sandbox Access Token** → `SQUARE_ACCESS_TOKEN` in `.env`
   - **Sandbox Location ID** (under Locations) → `SQUARE_LOCATION_ID` in `.env`
3. Leave `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_URL` blank for now — webhooks need an ngrok tunnel (see below)

With just the access token and location ID you can test the checkout redirect flow. The pending page will poll but never confirm (no webhook) until you wire up ngrok.

### Testing webhooks locally (optional)

The pending page polls for payment confirmation. To see the full flow:

1. Install [ngrok](https://ngrok.com) and run: `ngrok http 3000`
2. Copy the `https://` tunnel URL
3. In `.env`, set:
   ```
   SQUARE_WEBHOOK_URL=https://<your-tunnel>.ngrok.io/webhooks/square
   APP_URL=https://<your-tunnel>.ngrok.io
   ```
4. In Square Developer Dashboard → **Webhooks** → create a subscription:
   - URL: `https://<your-tunnel>.ngrok.io/webhooks/square`
   - Events: `payment.updated`
   - Copy the **Signature Key** → `SQUARE_WEBHOOK_SIGNATURE_KEY` in `.env`
5. Restart the dev server (`npm run dev`) after updating `.env`

Now complete a sandbox payment using Square's test card (`4111 1111 1111 1111`, any future expiry, any CVV) and the pending page will confirm within a few seconds.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-restarts on file changes) |
| `npm start` | Start without nodemon (production-style) |

## Project structure

```
ticketing/
  index.js                  — app entry point, middleware, route mounts
  src/
    db/
      knex.js               — SQLite (dev) / Postgres (prod) connection
      migrations/           — Knex migration files, run automatically on startup
    lib/
      square.js             — Square SDK singleton
    routes/
      events.js             — GET / (event page), POST /checkout
      webhooks.js           — POST /webhooks/square (HMAC-verified)
      tickets.js            — GET /ticket/pending, GET /api/ticket-status
      admin.js              — admin routes (Phase 5)
      scan.js               — door scanner routes (Phase 4)
    views/                  — EJS templates
```

## Environment variables

See `.env.example` for the full list with descriptions. Required for local dev:

| Variable | Where to get it |
|----------|----------------|
| `SQUARE_ACCESS_TOKEN` | Square Developer Dashboard → Sandbox tab |
| `SQUARE_LOCATION_ID` | Square Developer Dashboard → Locations |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square Developer Dashboard → Webhooks (only needed for webhook testing) |
| `SQUARE_WEBHOOK_URL` | Your ngrok tunnel URL + `/webhooks/square` (only needed for webhook testing) |
| `APP_URL` | `http://localhost:3000` for local dev |

## Deployment

Hosted on Railway. Push to `main` triggers a deploy. Railway injects all env vars — no `.env` file on the server. The Postgres `DATABASE_URL` is provided automatically by Railway's managed Postgres add-on.
