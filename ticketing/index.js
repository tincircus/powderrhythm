'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./src/db/knex');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Railway edge proxy — use X-Forwarded-For[0] as real client IP

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

const eventsRouter   = require('./src/routes/events');   // GET /events/:id, POST /events/:id/checkout
const webhooksRouter = require('./src/routes/webhooks'); // POST /webhooks/square
const ticketsRouter  = require('./src/routes/tickets');  // GET /ticket/pending, GET /api/ticket-status

app.use(express.static(path.join(__dirname, 'public')));
app.use('/webhooks', webhooksRouter);  // mount before '/' to avoid catch-all match issues
app.get('/', (req, res) => res.redirect(302, '/events/1'));
app.use('/events', eventsRouter);
app.use('/', ticketsRouter);
app.use('/', require('./src/routes/scan'));
app.use('/', require('./src/routes/admin'));

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

let server;

async function start() {
  try {
    await db.migrate.latest();
    console.log('Migrations complete');
    server = app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  const timer = setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit');
    process.exit(1); // abnormal termination — let Railway restart the container
  }, 10_000);

  const closeServer = server ? (cb) => server.close(cb) : (cb) => cb();
  closeServer(() => {
    clearTimeout(timer);
    db.destroy().then(() => {
      console.log('DB pool closed — exiting');
      process.exit(0);
    }).catch(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
