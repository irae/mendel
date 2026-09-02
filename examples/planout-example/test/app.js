const assert = require('node:assert/strict');
const test = require('node:test');

const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'mendel-development-middleware') {
        return () => (req, res, next) => next();
    }
    return originalLoad.call(this, request, parent, isMain);
};
const app = require('../app');
Module._load = originalLoad;

const visitorMiddleware = app._router.stack.find((layer) =>
    layer.handle.toString().includes('visitorId')
).handle;

test('assigns a UUID visitor id', () => {
    const req = { cookies: {}, query: {} };
    const response = { cookie() {} };

    visitorMiddleware(req, response, () => {});

    assert.match(
        req.visitorId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
});
