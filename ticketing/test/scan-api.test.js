'use strict';

/**
 * Tests for POST /api/scan and GET /api/scan/search endpoints.
 *
 * Uses Node.js built-in test runner (node:test) + node:assert.
 * Stubs the db module so no real SQLite file is needed.
 *
 * Run: node --test ticketing/test/scan-api.test.js
 * (from repo root) or: node --test test/scan-api.test.js
 * (from ticketing/ directory)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// ---- minimal stub for require('../db/knex') --------------------------------
// We intercept Module._resolveFilename to redirect db requires to our stub.
const Module = require('node:module');
const path = require('node:path');

// Build the absolute path that `require('../db/knex')` resolves to from
// ticketing/src/routes/scan.js
const DB_REAL_PATH = path.resolve(
    __dirname, '..', 'src', 'db', 'knex.js'
);

// Stub db — overwritten per test via helpers below
const dbStub = {
    _calls: [],
    _nextRowsAffected: 0,
    _nextFirstRow: null,

    // Simulate db('tickets').where(...).whereNull(...).update(...)
    // Knex builder is chainable; we return a thenable at each step.
    __call(tableName) {
        const self = dbStub;
        const builder = {
            where()       { return builder; },
            whereNull()   { return builder; },
            whereILike()  { return builder; },
            orWhereILike(){ return builder; },
            andWhere(fn)  { fn.call({ whereILike() { return builder; }, orWhereILike() { return builder; } }); return builder; },
            select()      { return builder; },
            limit()       { return builder; },
            update()      { return Promise.resolve(self._nextRowsAffected); },
            first()       { return Promise.resolve(self._nextFirstRow); },
            then(resolve) { return Promise.resolve([]).then(resolve); },
        };
        // Expose .fn.now() on the callable
        return builder;
    },
};

// Callable as db('tickets')
function dbStubFn(tableName) {
    return dbStub.__call(tableName);
}
dbStubFn.fn = { now: () => new Date().toISOString() };

// Inject stub into require cache BEFORE loading scan.js
require.cache[DB_REAL_PATH] = {
    id: DB_REAL_PATH,
    filename: DB_REAL_PATH,
    loaded: true,
    exports: dbStubFn,
};

// ---- load app after stub injection -----------------------------------------
const express = require('express');
const cookieParser = require('cookie-parser');
const { makeToken } = require('../src/middleware/auth');

// We need scan.js to load fresh so it picks up the db stub.
// Clear any cached version first.
const SCAN_ROUTE_PATH = path.resolve(__dirname, '..', 'src', 'routes', 'scan.js');
delete require.cache[SCAN_ROUTE_PATH];

const scanRouter = require('../src/routes/scan.js');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/', scanRouter);

let server;
let baseUrl;
let validCookie;

before(async () => {
    process.env.ADMIN_PASSWORD = 'testpass';
    validCookie = 'scan_auth=' + makeToken('testpass');

    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.ADMIN_PASSWORD;
});

// ---- helpers ----------------------------------------------------------------
function post(path, body, cookie) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
        };
        if (cookie) headers['Cookie'] = cookie;
        const req = http.request(baseUrl + path, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve({ status: res.statusCode, body: JSON.parse(data) }); });
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

function get(path, cookie) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (cookie) headers['Cookie'] = cookie;
        const req = http.request(baseUrl + path, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ============================================================================
// POST /api/scan tests
// ============================================================================

describe('POST /api/scan', () => {

    test('without cookie returns 401 JSON', async () => {
        const r = await post('/api/scan', { uuid: '00000000-0000-4000-a000-000000000000' }, null);
        assert.equal(r.status, 401);
        assert.ok(r.body.error, 'should have error field');
        assert.match(r.body.error, /Unauthorized/i);
    });

    test('with invalid cookie returns 401 JSON', async () => {
        const r = await post('/api/scan', { uuid: '00000000-0000-4000-a000-000000000000' }, 'scan_auth=badhash');
        assert.equal(r.status, 401);
        assert.match(r.body.error, /Unauthorized/i);
    });

    test('with no uuid returns 400 Invalid uuid', async () => {
        const r = await post('/api/scan', {}, validCookie);
        assert.equal(r.status, 400);
        assert.deepEqual(r.body, { error: 'Invalid uuid' });
    });

    test('with malformed uuid returns 400 Invalid uuid', async () => {
        const r = await post('/api/scan', { uuid: 'not-a-uuid' }, validCookie);
        assert.equal(r.status, 400);
        assert.deepEqual(r.body, { error: 'Invalid uuid' });
    });

    test('with unknown uuid returns ok:false reason:not_found', async () => {
        dbStub._nextRowsAffected = 0;
        dbStub._nextFirstRow = null; // ticket not found
        const r = await post('/api/scan', { uuid: '00000000-0000-4000-a000-000000000000' }, validCookie);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { ok: false, reason: 'not_found' });
    });

    test('valid unscanned ticket returns ok:true with name', async () => {
        dbStub._nextRowsAffected = 1;
        dbStub._nextFirstRow = { buyer_name: 'Jane Doe' };
        const r = await post('/api/scan', { uuid: '12345678-1234-4234-a234-123456789abc' }, validCookie);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { ok: true, name: 'Jane Doe' });
    });

    test('already-scanned ticket returns ok:false reason:already_scanned with scannedAt', async () => {
        const ts = '2026-05-20T10:00:00Z';
        dbStub._nextRowsAffected = 0;
        dbStub._nextFirstRow = { buyer_name: 'Jane Doe', scanned_at: ts };
        const r = await post('/api/scan', { uuid: '12345678-1234-4234-a234-123456789abc' }, validCookie);
        assert.equal(r.status, 200);
        assert.equal(r.body.ok, false);
        assert.equal(r.body.reason, 'already_scanned');
        assert.ok(r.body.scannedAt, 'should include scannedAt');
    });

});

// ============================================================================
// GET /api/scan/search tests
// ============================================================================

describe('GET /api/scan/search', () => {

    test('without cookie returns 401 JSON', async () => {
        const r = await get('/api/scan/search?q=test', null);
        assert.equal(r.status, 401);
        assert.match(r.body.error, /Unauthorized/i);
    });

    test('with empty q returns empty array (no db hit)', async () => {
        const r = await get('/api/scan/search?q=', validCookie);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, []);
    });

    test('with whitespace-only q returns empty array', async () => {
        const r = await get('/api/scan/search?q=   ', validCookie);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, []);
    });

    test('with query returns JSON array (db returns empty here)', async () => {
        // Override .then so builder returns array for this test
        // The builder's then handler returns [] by default — sufficient for this case
        const r = await get('/api/scan/search?q=jane', validCookie);
        assert.equal(r.status, 200);
        assert.ok(Array.isArray(r.body), 'body should be an array');
    });

});
