'use strict';

const { createHmac, timingSafeEqual } = require('crypto');

const COOKIE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

/**
 * makeToken(password) — HMAC-SHA256 signs the constant string 'powder-rhythm-scan'
 * with the password as the HMAC key. Returns a 64-char hex string.
 */
function makeToken(password) {
  return createHmac('sha256', password).update('powder-rhythm-scan').digest('hex');
}

/**
 * compareStrings(a, b) — timing-safe string comparison.
 * Returns false on mismatched lengths (timingSafeEqual throws) or when strings differ.
 */
function compareStrings(a, b) {
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false; // mismatched lengths throw — treat as not equal
  }
}

/**
 * makeAuthMiddleware(cookieName, loginPath) — factory returning a requireAuth middleware.
 * The returned middleware validates the HMAC token in req.cookies[cookieName].
 * Redirects to loginPath if missing or invalid; returns 500 if ADMIN_PASSWORD unset.
 *
 * @param {string} cookieName  - Name of the cookie to read (e.g. 'scan_auth', 'admin_auth')
 * @param {string} [loginPath='/scan/login']  - Redirect target when unauthenticated
 */
function makeAuthMiddleware(cookieName, loginPath = '/scan/login') {
  return function requireAuth(req, res, next) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      return res.status(500).send('ADMIN_PASSWORD not configured');
    }
    const token = req.cookies[cookieName];
    const expected = makeToken(password);
    if (token && compareStrings(token, expected)) {
      return next();
    }
    return res.redirect(loginPath);
  };
}

module.exports = { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE };
