'use strict';

exports.up = async function (knex) {
  await knex.schema.createTable('events', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.datetime('date').notNullable();
    t.string('venue').notNullable();
    t.integer('price_cents').notNullable();
    t.integer('capacity').notNullable();
    t.text('description').nullable();
    t.timestamps(true, true); // created_at, updated_at
  });

  await knex.schema.createTable('tickets', (t) => {
    t.increments('id').primary();
    t.uuid('uuid').notNullable().unique();
    t.integer('event_id').unsigned().notNullable()
      .references('id').inTable('events').onDelete('CASCADE');
    t.string('buyer_name').notNullable();
    t.string('buyer_email').notNullable();
    t.timestamp('scanned_at').nullable(); // NULL = not yet scanned (D-06)
    t.timestamps(true, true);
  });

  await knex.schema.createTable('processed_webhook_events', (t) => {
    t.increments('id').primary();
    t.string('square_event_id').notNullable().unique(); // idempotency key (D-09)
    t.timestamps(true, true);
  });

  // Seed event — D-10, D-11
  // TODO: Update price_cents and capacity before Phase 6 production deploy
  //       once real values are confirmed with the venue.
  const count = await knex('events').count('id as n').first();
  if (parseInt(count.n, 10) === 0) {
    await knex('events').insert({
      name: 'Powder Rhythm Launch',
      date: '2026-05-29 20:00:00',
      venue: 'Powder Rhythm, Baker City, OR',
      price_cents: 2000, // PLACEHOLDER — $20
      capacity: 50,      // PLACEHOLDER
      description: null,
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('processed_webhook_events');
  await knex.schema.dropTableIfExists('tickets');
  await knex.schema.dropTableIfExists('events');
};
