'use strict';

const express = require('express');
const router = express.Router();
const { WebhooksHelper } = require('square');
const db = require('../db/knex');

// POST /webhooks/square
// Receives Square payment event webhooks, verifies HMAC signature, and confirms pending tickets.
// SEC-01: All requests rejected with 400 if HMAC-SHA256 signature is invalid.
// SEC-02: Idempotency enforced via processed_webhook_events unique constraint on square_event_id.
router.post('/square', async (req, res) => {
  // Step 1 — HMAC verification (SEC-01)
  // req.rawBody is captured by express.json() verify callback in index.js before parsing occurs.
  // CRITICAL: pass req.rawBody (raw string), NOT JSON.stringify(req.body) — even minor whitespace
  // differences break the HMAC check (RESEARCH.md Pitfall 2).
  // NOTE: WebhooksHelper.verifySignature is async — must be awaited.
  // It throws SquareError when signatureKey or notificationUrl is null/empty (misconfiguration);
  // treat that as an invalid signature and return 400 so Square doesn't retry endlessly.
  const signature = req.headers['x-square-hmacsha256-signature'];
  let isValid = false;
  try {
    isValid = await WebhooksHelper.verifySignature({
      requestBody: req.rawBody,
      signatureHeader: signature,
      signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
      notificationUrl: process.env.SQUARE_WEBHOOK_URL,
    });
  } catch (err) {
    // SquareError thrown when env vars are missing or HMAC computation fails — treat as invalid
    console.error('Webhook: HMAC verification error', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  if (!isValid) return res.status(400).json({ error: 'Invalid signature' });

  // Step 2 — Event type filter
  // Only act on payment.updated with status COMPLETED.
  // Both payment.created and payment.updated fire for payment link completions;
  // processing only payment.updated/COMPLETED avoids double-processing (RESEARCH.md Pitfall 5).
  const { event_id: squareEventId, type, data } = req.body;
  if (type !== 'payment.updated') return res.status(200).json({ ok: true });

  const payment = data?.object?.payment;
  if (!payment || payment.status !== 'COMPLETED') return res.status(200).json({ ok: true });

  // Step 3 — Idempotency check (SEC-02)
  // INSERT processed_webhook_events with unique constraint on square_event_id.
  // Duplicate key = event already processed; return 200 silently.
  try {
    await db('processed_webhook_events').insert({ square_event_id: squareEventId });
  } catch (err) {
    // SQLite: SQLITE_CONSTRAINT_UNIQUE  |  PostgreSQL: 23505
    const isDuplicate = err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505';
    if (isDuplicate) return res.status(200).json({ ok: true, skipped: true });
    throw err; // re-throw unexpected errors to global error handler
  }

  // Step 4 — Confirm ticket via order_id correlation
  // Correlate via square_order_id (NOT reference_id — reference_id is absent from payment.updated
  // in Square sandbox and unreliable in production; see RESEARCH.md Critical Finding, D-07 revision).
  // WHERE clause includes status: 'pending' so UPDATE is a no-op if already confirmed.
  const updated = await db('tickets')
    .where({ square_order_id: payment.order_id, status: 'pending' })
    .update({ status: 'confirmed' });

  if (updated === 0) {
    // Ticket may not exist or was already confirmed — log for debugging.
    // Do NOT return an error: Square must receive 200 or it will retry indefinitely.
    console.warn('Webhook: no pending ticket matched order_id', payment.order_id);
  }

  // Step 5 — Return success
  return res.status(200).json({ ok: true });
});

module.exports = router;
