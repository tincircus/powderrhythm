'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const QRCode = require('qrcode');

// GET /ticket/pending?uuid=<uuid>
// Renders the polling holding page while payment is being confirmed.
// Redirects to / if uuid is missing or does not match a known ticket.
// NOTE: This route does NOT set ticket status to 'confirmed' — status is set
// exclusively by the webhook handler (Plan 02-03). T-02-14 mitigation.
router.get('/ticket/pending', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.redirect('/');
  // Verify ticket exists before rendering (avoid infinite polling for bad UUIDs)
  const ticket = await db('tickets').where({ uuid }).first();
  if (!ticket) return res.redirect('/');
  res.render('pending', { uuid });
});

// GET /api/ticket-status?uuid=<uuid>
// Returns JSON { status } for the given ticket UUID.
// Returns 400 for missing uuid, 404 for unknown uuid.
// Returns only { status } — no buyer PII (name, email) is returned here (T-02-13).
router.get('/api/ticket-status', async (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: 'Missing uuid' });
  const ticket = await db('tickets').select('status').where({ uuid }).first();
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json({ status: ticket.status });
});

// GET /ticket/:uuid
// Renders the buyer-facing confirmation page with QR code.
// Redirects to / if uuid is not found or ticket is not confirmed.
// T-03-04 mitigation: WHERE clause includes status:'confirmed' — pending tickets redirect to /.
router.get('/ticket/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const ticket = await db('tickets').where({ uuid, status: 'confirmed' }).first();
  if (!ticket) return res.redirect('/');
  res.render('ticket', { ticket });
});

// GET /ticket/:uuid/qr.png
// Streams a QR code PNG encoding the full ticket URL for the given confirmed ticket.
// Returns 404 for unknown or non-confirmed UUIDs.
// select('uuid') only — no PII (buyer_name, buyer_email) needed here.
// T-03-06 mitigation: res.on('error') attached before streaming to prevent server crash
// when buyer navigates away mid-stream. QRCode.toFileStream emits errors on the passed
// stream (res), not as a return value — res is the correct error event source.
router.get('/ticket/:uuid/qr.png', async (req, res) => {
  const { uuid } = req.params;
  const ticket = await db('tickets').select('uuid').where({ uuid, status: 'confirmed' }).first();
  if (!ticket) return res.status(404).end();
  const APP_URL = process.env.APP_URL || 'http://localhost:3000';
  const qrUrl = `${APP_URL}/ticket/${ticket.uuid}`;
  res.type('image/png');
  res.setHeader('Content-Disposition', `attachment; filename="ticket-${uuid}.png"`);
  res.on('error', (err) => {
    console.error('QR stream error:', err);
    if (!res.headersSent) res.status(500).end();
  });
  QRCode.toFileStream(res, qrUrl, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
});

module.exports = router;
