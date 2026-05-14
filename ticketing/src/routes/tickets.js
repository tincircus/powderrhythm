'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');

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

module.exports = router;
