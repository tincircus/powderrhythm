'use strict';

const path = require('path');
const knex = require('knex');

const db = knex(
  process.env.DATABASE_URL
    ? {
        client: 'pg',
        connection: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }, // Required for Railway's self-signed cert
        },
        migrations: {
          directory: path.join(__dirname, 'migrations'),
        },
      }
    : {
        client: 'better-sqlite3',
        connection: {
          filename: path.join(__dirname, '..', '..', 'dev.sqlite'),
        },
        useNullAsDefault: true, // Required for SQLite: suppresses "no default value" warning
        migrations: {
          directory: path.join(__dirname, 'migrations'),
        },
      }
);

module.exports = db;
