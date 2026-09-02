/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

const path = require('path');
const test = require('tap').test;

const resolved = require.resolve('mendel-development-middleware', {
    paths: [path.join(__dirname, '..')],
});
require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: () => (req, res, next) => next(),
};

const app = require('../app');
const express = require('express');
const cookieParser = require('cookie-parser');

function startServer() {
    const visitorLayer = app._router.stack.find(
        (layer) =>
            layer.route === undefined &&
            layer.handle.toString().includes('visitorId')
    );
    const isolated = express();
    isolated.use(cookieParser());
    isolated.use(visitorLayer.handle);
    isolated.get('/', (req, res) => res.json({ visitorId: req.visitorId }));

    return new Promise((resolve) => {
        const server = isolated.listen(0, () => resolve(server));
    });
}

test('assigns a fresh visitorId to a new visitor', async (t) => {
    const server = await startServer();
    t.teardown(() => server.close());

    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    const body = await response.json();

    t.match(body.visitorId, UUID_V4);
});

test('keeps the visitorId from the cookie', async (t) => {
    const server = await startServer();
    t.teardown(() => server.close());

    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
        headers: { cookie: 'visitorId=present-visitor' },
    });
    const body = await response.json();

    t.equal(body.visitorId, 'present-visitor');
});

test('resets the visitorId when asked to', async (t) => {
    const server = await startServer();
    t.teardown(() => server.close());

    const response = await fetch(
        `http://127.0.0.1:${server.address().port}/?reset=1`,
        { headers: { cookie: 'visitorId=present-visitor' } }
    );
    const body = await response.json();

    t.match(body.visitorId, UUID_V4);
    t.not(body.visitorId, 'present-visitor');
});

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
