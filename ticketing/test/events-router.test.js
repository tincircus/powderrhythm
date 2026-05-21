'use strict';

/**
 * Tests for GET /events/:id and POST /events/:id/checkout routes.
 *
 * Uses Node.js built-in test runner (node:test) + node:assert.
 * Stubs the db and square modules so no real DB or Square credentials are needed.
 *
 * Run: node --test ticketing/test/events-router.test.js
 * (from repo root) or: node --test test/events-router.test.js
 * (from ticketing/ directory)
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');

// ---- stubs ---------------------------------------------------------------

const DB_REAL_PATH = path.resolve(__dirname, '..', 'src', 'db', 'knex.js');
const SQUARE_REAL_PATH = path.resolve(__dirname, '..', 'src', 'lib', 'square.js');

// Mutable stub state
const dbStub = {
    _event: null,
    _confirmedCount: 0,
    _insertId: null,
    _updateCalled: false,
};

// Knex builder returned for any db('table') call
function makeBuilder(table) {
    const builder = {
        _wheres: {},
        where(cond) { Object.assign(this._wheres, cond); return this; },
        whereNull() { return this; },
        count() { return this; },
        limit() { return this; },
        select() { return this; },
        insert(row) {
            return Promise.resolve([1]);
        },
        update(data) {
            dbStub._updateCalled = true;
            return Promise.resolve(1);
        },
        delete() { return Promise.resolve(1); },
        first() {
            if (table === 'events') {
                const id = this._wheres.id;
                if (id !== undefined) {
                    return Promise.resolve(
                        dbStub._event && dbStub._event.id === id ? dbStub._event : null
                    );
                }
                return Promise.resolve(dbStub._event);
            }
            if (table === 'tickets') {
                return Promise.resolve({ n: String(dbStub._confirmedCount) });
            }
            return Promise.resolve(null);
        },
    };
    return builder;
}

function dbStubFn(table) {
    return makeBuilder(table);
}
// Support db.transaction(async (trx) => { ... }) — pass a stub trx that behaves
// like dbStubFn so transactional routes can be tested without a real DB.
dbStubFn.transaction = async (callback) => callback(dbStubFn);
dbStubFn.fn = { now: () => new Date().toISOString() };

// Square stub
const squareStub = {
    checkout: {
        paymentLinks: {
            create: async () => ({
                paymentLink: {
                    url: 'https://square.example.com/pay/test',
                    orderId: 'ORDER123',
                },
            }),
        },
    },
};

// Inject stubs into require cache BEFORE loading events.js
require.cache[DB_REAL_PATH] = {
    id: DB_REAL_PATH, filename: DB_REAL_PATH, loaded: true, exports: dbStubFn,
};
require.cache[SQUARE_REAL_PATH] = {
    id: SQUARE_REAL_PATH, filename: SQUARE_REAL_PATH, loaded: true, exports: squareStub,
};

// ---- load router after stub injection ------------------------------------
const express = require('express');

const EVENTS_ROUTE_PATH = path.resolve(__dirname, '..', 'src', 'routes', 'events.js');
delete require.cache[EVENTS_ROUTE_PATH];

const eventsRouter = require('../src/routes/events.js');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '..', 'src', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use('/events', eventsRouter);

let server;
let baseUrl;

before(async () => {
    process.env.APP_URL = 'http://localhost:3000';
    process.env.SQUARE_LOCATION_ID = 'LOC123';
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
    dbStub._event = null;
    dbStub._confirmedCount = 0;
    dbStub._updateCalled = false;
});

// ---- helpers -------------------------------------------------------------
function get(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request(baseUrl + urlPath, { method: 'GET' }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function post(urlPath, fields) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams(fields).toString();
        const req = http.request(baseUrl + urlPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(params),
            },
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => { resolve({ status: res.statusCode, headers: res.headers, body: data }); });
        });
        req.on('error', reject);
        req.write(params);
        req.end();
    });
}

// ---- tests ---------------------------------------------------------------

describe('GET /events/:id', () => {

    test('returns 200 and renders event page for a valid event', async () => {
        dbStub._event = {
            id: 1,
            name: 'Test Show',
            date: '2026-05-29',
            venue: 'Powder Rhythm',
            price_cents: 1500,
            capacity: 50,
        };
        const r = await get('/events/1');
        assert.equal(r.status, 200);
        assert.ok(r.body.includes('Test Show'), 'body should contain event name');
        assert.ok(
            r.body.includes('/events/1/checkout'),
            'form action should use /events/1/checkout'
        );
    });

    test('returns 404 for unknown event ID', async () => {
        dbStub._event = null; // no event in DB
        const r = await get('/events/999');
        assert.equal(r.status, 404);
    });

    test('returns 404 for non-numeric event ID', async () => {
        const r = await get('/events/abc');
        assert.equal(r.status, 404);
    });

    test('old GET / path returns 404', async () => {
        // The old root mount no longer handles GET /; events router is at /events
        const r = await get('/');
        assert.equal(r.status, 404);
    });

});

describe('POST /events/:id/checkout', () => {

    test('returns 404 for unknown event ID', async () => {
        dbStub._event = null;
        const r = await post('/events/999/checkout', { name: 'Jane', email: 'jane@example.com' });
        assert.equal(r.status, 404);
    });

    test('returns 404 for non-numeric event ID', async () => {
        const r = await post('/events/abc/checkout', { name: 'Jane', email: 'jane@example.com' });
        assert.equal(r.status, 404);
    });

    test('missing name redirects to /events/:id?error=name', async () => {
        dbStub._event = { id: 1, name: 'Show', date: '2026-05-29', venue: 'PR', price_cents: 1500, capacity: 50 };
        const r = await post('/events/1/checkout', { name: '', email: 'jane@example.com' });
        assert.equal(r.status, 302);
        assert.ok(
            r.headers.location.includes('/events/1') && r.headers.location.includes('error=name'),
            `location should be /events/1?error=name, got ${r.headers.location}`
        );
    });

    test('invalid email redirects to /events/:id?error=email', async () => {
        dbStub._event = { id: 1, name: 'Show', date: '2026-05-29', venue: 'PR', price_cents: 1500, capacity: 50 };
        const r = await post('/events/1/checkout', { name: 'Jane', email: 'notanemail' });
        assert.equal(r.status, 302);
        assert.ok(
            r.headers.location.includes('/events/1') && r.headers.location.includes('error=email'),
            `location should be /events/1?error=email, got ${r.headers.location}`
        );
    });

    test('sold-out event redirects to /events/:id?error=soldout', async () => {
        dbStub._event = { id: 1, name: 'Show', date: '2026-05-29', venue: 'PR', price_cents: 1500, capacity: 50 };
        dbStub._confirmedCount = 50; // at capacity
        const r = await post('/events/1/checkout', { name: 'Jane', email: 'jane@example.com' });
        assert.equal(r.status, 302);
        assert.ok(
            r.headers.location.includes('/events/1') && r.headers.location.includes('error=soldout'),
            `location should be /events/1?error=soldout, got ${r.headers.location}`
        );
    });

    test('valid checkout redirects to Square payment URL', async () => {
        dbStub._event = { id: 1, name: 'Show', date: '2026-05-29', venue: 'PR', price_cents: 1500, capacity: 50 };
        dbStub._confirmedCount = 0;
        const r = await post('/events/1/checkout', { name: 'Jane', email: 'jane@example.com' });
        assert.equal(r.status, 302);
        assert.ok(
            r.headers.location.includes('square.example.com'),
            `should redirect to Square URL, got ${r.headers.location}`
        );
    });

    test('old POST /checkout path returns 404', async () => {
        const r = await post('/checkout', { name: 'Jane', email: 'jane@example.com' });
        assert.equal(r.status, 404);
    });

});
