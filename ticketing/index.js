'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./src/db/knex');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

app.use(express.json({
  verify: (req, _res, buf) => {
    // Capture raw body string for Square webhook HMAC verification (SEC-01)
    // All routes get this; only webhooks.js uses req.rawBody
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use(require('cookie-parser')());

const eventsRouter   = require('./src/routes/events');   // GET /, POST /checkout
const webhooksRouter = require('./src/routes/webhooks'); // POST /webhooks/square
const ticketsRouter  = require('./src/routes/tickets');  // GET /ticket/pending, GET /api/ticket-status

app.use('/webhooks', webhooksRouter);  // mount before '/' to avoid catch-all match issues
app.use('/', eventsRouter);
app.use('/', ticketsRouter);
app.use('/', require('./src/routes/scan'));

// GET /health — DB connectivity check
app.get('/health', async (req, res) => {
  try {
    await db.raw('select 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Global error handler — 4-argument signature required by Express 5
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await db.migrate.latest();
    console.log('Migrations complete');
    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
