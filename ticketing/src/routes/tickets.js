'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const QRCode = require('qrcode');

// UUID v4 format guard — applied before every DB query that accepts a uuid param.
// Knex parameterized queries prevent SQL injection, but this avoids unnecessary DB
// round-trips for clearly invalid inputs and ensures Content-Disposition filenames
// cannot contain characters outside the expected hex+hyphen alphabet.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /ticket/pending?uuid=<uuid>
// Renders the polling holding page while payment is being confirmed.
// Redirects to / if uuid is missing, malformed, or does not match a known ticket.
// NOTE: This route does NOT set ticket status to 'confirmed' — status is set
// exclusively by the webhook handler (Plan 02-03). T-02-14 mitigation.
router.get('/ticket/pending', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.redirect('/');
  if (!UUID_RE.test(uuid)) return res.redirect('/');
  // Verify ticket exists before rendering (avoid infinite polling for bad UUIDs)
  const ticket = await db('tickets').where({ uuid }).first();
  if (!ticket) return res.redirect('/');
  // JSON.stringify produces a double-quoted JS string literal with all special
  // characters properly escaped for a script context (CR-01 mitigation).
  res.render('pending', { uuid: JSON.stringify(ticket.uuid) });
});

// GET /api/ticket-status?uuid=<uuid>
// Returns JSON { status } for the given ticket UUID.
// Returns 400 for missing/malformed uuid, 404 for unknown uuid.
// Returns only { status } — no buyer PII (name, email) is returned here (T-02-13).
router.get('/api/ticket-status', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Missing uuid' });
  if (!UUID_RE.test(uuid)) return res.status(400).json({ error: 'invalid uuid' });
  const ticket = await db('tickets').select('status').where({ uuid }).first();
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json({ status: ticket.status });
});

// GET /ticket/:uuid
// Renders the buyer-facing confirmation page with QR code.
// Redirects to / if uuid is malformed, not found, or ticket is not confirmed.
// T-03-04 mitigation: WHERE clause includes status:'confirmed' — pending tickets redirect to /.
router.get('/ticket/:uuid', async (req, res) => {
  const { uuid } = req.params;
  if (!UUID_RE.test(uuid)) return res.redirect('/');
  const ticket = await db('tickets').where({ uuid, status: 'confirmed' }).first();
  if (!ticket) return res.redirect('/');
  res.render('ticket', { ticket });
});

// GET /ticket/:uuid/qr.png
// Returns a QR code PNG encoding the full ticket URL for the given confirmed ticket.
// Returns 404 for unknown or non-confirmed UUIDs.
// select('uuid') only — no PII (buyer_name, buyer_email) needed here.
// Buffered via QRCode.toBuffer (not toFileStream) so that errors during QR generation
// occur before headers are sent, allowing a clean 500 response (WR-02 mitigation).
// Content-Length is set to allow clients to detect truncated responses.
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

module.exports = router;
