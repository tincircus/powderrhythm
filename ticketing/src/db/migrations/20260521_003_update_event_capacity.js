'use strict';

exports.up = async function (knex) {
  await knex('events').where({ capacity: 50 }).update({ capacity: 20 });
};

exports.down = async function (knex) {
  await knex('events').where({ capacity: 20 }).update({ capacity: 50 });
};
