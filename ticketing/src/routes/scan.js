'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE } = require('../middleware/auth');

const COOKIE_NAME    = 'scan_auth';
const UUID_RE        = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireScanAuth = makeAuthMiddleware('scan_auth');

// GET /scan — password-gated camera UI
router.get('/scan', requireScanAuth, (req, res) => {
  res.render('scan');
});

// GET /scan/login — login form
router.get('/scan/login', (req, res) => {
  res.render('scan-login', { error: null });
});

// POST /scan/login — validate password, set cookie on success
router.post('/scan/login', (req, res) => {
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) {
    return res.status(500).send('ADMIN_PASSWORD not configured');
  }
  if (!compareStrings(req.body.password || '', correct)) {
    return res.render('scan-login', { error: 'Wrong password. Try again.' });
  }
  res.cookie(COOKIE_NAME, makeToken(correct), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  });
  return res.redirect('/scan');
});

// POST /api/scan — atomic ticket check-in endpoint (SEC-03)
// Inline auth check returns 401 JSON (not redirect) so browser fetch() can parse the error.
// Uses UPDATE WHERE scanned_at IS NULL — exactly one concurrent request gets rowsAffected === 1.
router.post('/api/scan', async (req, res) => {
  try {
    // Step 1 — Inline auth check (T-4-08: fetch()-compatible 401 JSON)
    const password = process.env.ADMIN_PASSWORD;
    const token = req.cookies[COOKIE_NAME];
    if (!password || !token || !compareStrings(token, makeToken(password))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Step 2 — UUID validation
    const { uuid } = req.body;
    if (!uuid || !UUID_RE.test(uuid)) {
      return res.status(400).json({ error: 'Invalid uuid' });
    }

    // Step 3 — Atomic UPDATE (SEC-03, T-4-07)
    // status: 'confirmed' ensures unconfirmed (unpaid) tickets cannot be scanned in (CR-01).
    // whereNull('scanned_at') ensures only one concurrent request succeeds.
    // No .returning() chained — preserves cross-DB integer rows-affected result (Pitfall 6).
    const rowsAffected = await db('tickets')
      .where({ uuid, status: 'confirmed' })
      .whereNull('scanned_at')
      .update({ scanned_at: db.fn.now() });

    if (rowsAffected === 1) {
      // Step 4 — Fetch buyer name for green display (no email — T-4-09)
      const ticket = await db('tickets').select('buyer_name').where({ uuid }).first();
      return res.json({ ok: true, name: ticket ? ticket.buyer_name : null });
    }

    // Step 5 — rowsAffected === 0: already scanned or not found
    // status: 'confirmed' guard prevents leaking existence of pending tickets (CR-01).
    const ticket = await db('tickets').select('buyer_name', 'scanned_at').where({ uuid, status: 'confirmed' }).first();
    if (!ticket) {
      return res.json({ ok: false, reason: 'not_found' });
    }
    return res.json({ ok: false, reason: 'already_scanned', scannedAt: ticket.scanned_at });
  } catch (err) {
    console.error('POST /api/scan error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/scan/search — name/email lookup fallback (D-06)
// Auth-gated via inline cookie check (same pattern as POST /api/scan).
// Returns confirmed tickets matching buyer_name or buyer_email (case-insensitive), limit 20.
router.get('/api/scan/search', async (req, res) => {
  try {
    // Step 1 — Inline auth check
    const password = process.env.ADMIN_PASSWORD;
    const token = req.cookies[COOKIE_NAME];
    if (!password || !token || !compareStrings(token, makeToken(password))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Step 2 — Minimum-length guard (mirrors client-side check; also blocks bare % / _ terms)
    const q = req.query.q;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // Step 3 — Sanitize and escape LIKE metacharacters (WR-03)
    // Escaping % and _ prevents a single-character wildcard query from dumping all rows.
    // The backslash escape works on both SQLite and Postgres with ESCAPE '\\'.
    const term = q.trim();
    const safeTerm = term.replace(/[%_\\]/g, '\\$&');

    // Step 4 — Case-insensitive name/email match with parameterized LIKE (T-4-11)
    // whereILike maps to ILIKE on Postgres and LIKE on SQLite (ASCII case-insensitive by default).
    let rows;
    try {
      rows = await db('tickets')
        .select('uuid', 'buyer_name', 'buyer_email', 'scanned_at')
        .where({ status: 'confirmed' })
        .andWhere(function () {
          this.whereILike('buyer_name', '%' + safeTerm + '%')
              .orWhereILike('buyer_email', '%' + safeTerm + '%');
        })
        .limit(20);
    } catch (iLikeErr) {
      // Fallback for older Knex versions that lack whereILike
      rows = await db('tickets')
        .select('uuid', 'buyer_name', 'buyer_email', 'scanned_at')
        .where({ status: 'confirmed' })
        .andWhere(function () {
          this.whereRaw('LOWER(buyer_name) LIKE ? ESCAPE \'\\\\\'', ['%' + safeTerm.toLowerCase() + '%'])
              .orWhereRaw('LOWER(buyer_email) LIKE ? ESCAPE \'\\\\\'', ['%' + safeTerm.toLowerCase() + '%']);
        })
        .limit(20);
    }

    // Step 5 — Return results (limit already applied)
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/scan/search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
