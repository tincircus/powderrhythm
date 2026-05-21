'use strict';

const { randomUUID } = require('crypto');
const express = require('express');
const router = express.Router();
const db = require('../db/knex');
const squareClient = require('../lib/square');

// GET /events/:id, POST /events/:id/checkout
// Express 5: async handler — errors auto-forwarded to global error handler
router.get('/:id', async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(404).json({ error: 'Event not found' });

  const event = await db('events').where({ id: eventId }).first();
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const confirmedCount = await db('tickets')
    .where({ event_id: event.id, status: 'confirmed' })
    .count('id as n')
    .first()
    .then((r) => parseInt(r.n, 10));

  const isSoldOut = confirmedCount >= event.capacity;

  // Capacity bucket thresholds (D-12, from 02-UI-SPEC.md §Capacity Badge)
  // Tuned for 50-seat venue; scale proportionally with event.capacity
  const ratio = confirmedCount / event.capacity;
  let capacityLabel;
  if (isSoldOut)          capacityLabel = 'Sold Out';
  else if (ratio >= 0.96) capacityLabel = 'Almost Gone';
  else if (ratio >= 0.80) capacityLabel = 'A Few Left';
  else if (ratio >= 0.60) capacityLabel = 'Limited';
  else                    capacityLabel = 'Available';

  const errorParam = req.query.error || null;
  res.render('event', { event, confirmedCount, capacityLabel, isSoldOut, errorParam });
});

// POST /events/:id/checkout — validate input, create pending ticket, redirect to Square
// Express 5: async handler — errors forwarded except the explicit Square API try/catch
router.post('/:id/checkout', async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) return res.status(404).json({ error: 'Event not found' });

  const { name, email } = req.body;

  // Input validation — return to event page with error on failure
  if (!name || !name.trim()) return res.redirect(`/events/${eventId}?error=name`);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.redirect(`/events/${eventId}?error=email`);
  }

  const event = await db('events').where({ id: eventId }).first();
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Atomically check capacity and insert pending ticket to prevent TOCTOU oversell (CR-02)
  const uuid = randomUUID();
  let soldOut = false;
  await db.transaction(async (trx) => {
    const { n } = await trx('tickets')
      .where({ event_id: event.id, status: 'confirmed' })
      .count('id as n')
      .first();
    if (parseInt(n, 10) >= event.capacity) {
      soldOut = true;
      return;
    }
    await trx('tickets').insert({
      uuid,
      event_id: event.id,
      buyer_name: name.trim(),
      buyer_email: email.trim().toLowerCase(),
      status: 'pending',
    });
  });
  if (soldOut) return res.redirect(`/events/${eventId}?error=soldout`);

  // Create Square payment link
  const redirectUrl = `${process.env.APP_URL}/ticket/pending?uuid=${uuid}`;
  let paymentLink;
  try {
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      quickPay: {
        name: event.name,
        priceMoney: {
          amount: BigInt(event.price_cents), // Square SDK requires BigInt for money
          currency: 'USD',
        },
        locationId: process.env.SQUARE_LOCATION_ID,
      },
      checkoutOptions: {
        redirectUrl,
      },
      prePopulatedData: {
        buyerEmail: email.trim().toLowerCase(),
      },
    });
    paymentLink = response.paymentLink;
  } catch (err) {
    // Square API failed — clean up pending row to avoid orphaned records (Pitfall 6)
    try {
      await db('tickets').where({ uuid }).delete();
    } catch (cleanupErr) {
      console.error('Failed to clean up orphaned pending ticket:', uuid, cleanupErr);
    }
    return res.status(500).render('error', {
      message: 'Something went wrong starting checkout. Try again or contact us.',
    });
  }

  // Store order_id for webhook correlation (D-07 revised: use order_id, NOT reference_id)
  await db('tickets').where({ uuid }).update({
    square_order_id: paymentLink.orderId,
  });

  return res.redirect(302, paymentLink.url);
});

module.exports = router;
