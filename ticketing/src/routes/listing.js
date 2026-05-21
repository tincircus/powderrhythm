'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/knex');

const PAGE_SIZE = 20;
const LOW_THRESHOLD = 10;

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const [events, countResult] = await Promise.all([
      db('events')
        .whereRaw('date > CURRENT_TIMESTAMP')
        .orderBy('date', 'asc')
        .limit(PAGE_SIZE)
        .offset(offset),
      db('events')
        .whereRaw('date > CURRENT_TIMESTAMP')
        .count('id as n')
        .first(),
    ]);

    const totalCount = parseInt(countResult.n, 10);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    let confirmedCounts = {};
    if (events.length > 0) {
      const eventIds = events.map(e => e.id);
      const rows = await db('tickets')
        .whereIn('event_id', eventIds)
        .where({ status: 'confirmed' })
        .groupBy('event_id')
        .select('event_id')
        .count('id as n');
      rows.forEach(r => {
        confirmedCounts[r.event_id] = parseInt(r.n, 10);
      });
    }

    const decoratedEvents = events.map(event => {
      const confirmed = confirmedCounts[event.id] || 0;
      const seatsLeft = event.capacity - confirmed;
      const isSoldOut = confirmed >= event.capacity;
      let badgeLabel, badgeClass;
      if (isSoldOut) {
        badgeLabel = 'Sold Out';
        badgeClass = 'sold-out';
      } else if (seatsLeft < LOW_THRESHOLD) {
        badgeLabel = `${seatsLeft} seats left`;
        badgeClass = 'seats-left';
      } else {
        badgeLabel = 'Available';
        badgeClass = 'available';
      }
      return { ...event, isSoldOut, badgeLabel, badgeClass };
    });

    res.render('events-list', {
      events: decoratedEvents,
      pagination: {
        page,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (err) {
    console.error('GET / listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
