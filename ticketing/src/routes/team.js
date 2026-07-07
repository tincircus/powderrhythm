'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const router = express.Router();
const { makeAuthMiddleware, makeToken, compareStrings, COOKIE_MAX_AGE } = require('../middleware/auth');

const COOKIE_NAME = 'team_auth';
const DOCS_DIR = path.join(__dirname, '..', '..', 'team-docs');
const SLUG_RE = /^[a-z0-9-]+$/;

const requireTeamAuth = makeAuthMiddleware('team_auth', '/team/login', 'TEAM_PASSWORD');

// Build the list of available docs (title from first "# " heading, sorted newest-first by mtime).
function listDocs() {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs.readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace(/\.md$/, '');
      const full = path.join(DOCS_DIR, f);
      const raw = fs.readFileSync(full, 'utf8');
      const m = raw.match(/^#\s+(.+)$/m);
      return { slug, title: m ? m[1].trim() : slug, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// GET /team/login — password form
router.get('/team/login', (req, res) => {
  res.render('team-login', { error: null });
});

// POST /team/login — validate TEAM_PASSWORD, set cookie on success
router.post('/team/login', (req, res) => {
  const correct = process.env.TEAM_PASSWORD;
  if (!correct) {
    return res.status(500).send('TEAM_PASSWORD not configured');
  }
  if (!compareStrings(req.body.password || '', correct)) {
    return res.render('team-login', { error: 'Wrong password. Try again.' });
  }
  res.cookie(COOKIE_NAME, makeToken(correct), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  });
  return res.redirect('/team');
});

// GET /team — index of team docs (auth-gated)
router.get('/team', requireTeamAuth, (req, res) => {
  res.render('team', { docs: listDocs() });
});

// GET /team/:slug — render a single doc (auth-gated)
router.get('/team/:slug', requireTeamAuth, (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) {
    return res.status(400).render('error', { message: 'Invalid document name' });
  }
  const full = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(full)) {
    return res.status(404).render('error', { message: 'Document not found' });
  }
  const raw = fs.readFileSync(full, 'utf8');
  const m = raw.match(/^#\s+(.+)$/m);
  return res.render('team-doc', {
    title: m ? m[1].trim() : slug,
    html: marked.parse(raw),
    docs: listDocs(),
    slug,
  });
});

module.exports = router;
