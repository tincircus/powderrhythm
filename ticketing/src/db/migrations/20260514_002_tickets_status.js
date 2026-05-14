'use strict';

exports.up = async function (knex) {
  await knex.schema.alterTable('tickets', (t) => {
    t.string('status').notNullable().defaultTo('confirmed');
    // square_order_id: used for webhook correlation (see RESEARCH.md critical finding — D-07 revision)
    // Store order_id returned from Square payment link creation; matched in payment.updated webhook
    t.string('square_order_id').nullable();
  });

  // Existing rows (Phase 1 seeds) are treated as confirmed automatically via defaultTo('confirmed')
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tickets', (t) => {
    t.dropColumn('square_order_id');
    t.dropColumn('status');
  });
};
