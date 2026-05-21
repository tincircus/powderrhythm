'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const { makeAuthMiddleware, makeToken, compareStrings } = require('../middleware/auth');

const COOKIE_NAME    = 'scan_auth';
const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
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

module.exports = router;
