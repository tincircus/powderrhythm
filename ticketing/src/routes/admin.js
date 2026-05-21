'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE } = require('../middleware/auth');

const COOKIE_NAME = 'admin_auth';
const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireAdminAuth = makeAuthMiddleware('admin_auth', '/admin/login');

// GET /admin/login — password form
router.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

// POST /admin/login — validate password, set cookie on success
router.post('/admin/login', (req, res) => {
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) {
    return res.status(500).send('ADMIN_PASSWORD not configured');
  }
  if (!compareStrings(req.body.password || '', correct)) {
    return res.render('admin-login', { error: 'Wrong password. Try again.' });
  }
  res.cookie(COOKIE_NAME, makeToken(correct), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  });
  return res.redirect('/admin');
});

// GET /admin — attendee list with headcount banner (auth-gated)
router.get('/admin', requireAdminAuth, async (req, res) => {
  try {
    const attendees = await db('tickets')
      .where({ status: 'confirmed' })
      .orderBy('buyer_name', 'asc')
      .select('uuid', 'buyer_name', 'email', 'scanned_at');

    const checkedIn = attendees.filter(t => t.scanned_at !== null).length;
    const totalSold = attendees.length;

    return res.render('admin', { checkedIn, totalSold, attendees });
  } catch (err) {
    console.error('GET /admin error:', err);
    return res.status(500).render('error', { message: 'Database error' });
  }
});

// POST /api/admin/checkin/:uuid — manual check-in endpoint (added in Plan 02)
// Placeholder: inline auth + atomic UPDATE, auth-gated via admin_auth cookie.
router.post('/api/admin/checkin/:uuid', async (req, res) => {
  try {
    // Inline auth check (fetch()-compatible 401 JSON)
    const password = process.env.ADMIN_PASSWORD;
    const token = req.cookies[COOKIE_NAME];
    if (!password || !token || !compareStrings(token, makeToken(password))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // UUID validation (from URL param)
    const { uuid } = req.params;
    if (!uuid || !UUID_RE.test(uuid)) {
      return res.status(400).json({ error: 'Invalid uuid' });
    }

    // Atomic UPDATE WHERE scanned_at IS NULL
    const rowsAffected = await db('tickets')
      .where({ uuid, status: 'confirmed' })
      .whereNull('scanned_at')
      .update({ scanned_at: db.fn.now() });

    if (rowsAffected === 1) {
      const ticket = await db('tickets').select('scanned_at').where({ uuid }).first();
      return res.json({ ok: true, scanned_at: ticket ? ticket.scanned_at : null });
    }

    // rowsAffected === 0: already checked in or not found
    const ticket = await db('tickets')
      .select('scanned_at')
      .where({ uuid, status: 'confirmed' })
      .first();

    if (!ticket) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.status(409).json({ already_checked_in: true, scanned_at: ticket.scanned_at });
  } catch (err) {
    console.error('POST /api/admin/checkin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
