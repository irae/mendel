/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var t = require('tap');
var http = require('http');

var devMiddleware = require.resolve('mendel-development-middleware');
require.cache[devMiddleware] = {
    id: devMiddleware,
    filename: devMiddleware,
    loaded: true,
    exports: function () {
        return function (req, res, next) {
            next();
        };
    },
};

var app = require('../app');

var server;

t.test('assigns a v4 UUID visitorId to anonymous visitors', async (t) => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    var url = `http://127.0.0.1:${server.address().port}/unrouted`;
    var response = await new Promise((resolve, reject) => {
        http.get(url, resolve).on('error', reject);
    });
    response.resume();

    var cookies = response.headers['set-cookie'] || [];
    var visitorIdCookie = cookies.find((c) => c.startsWith('visitorId='));
    t.match(
        visitorIdCookie,
        /^visitorId=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}(;|$)/,
        'anonymous visitor gets a v4 UUID cookie'
    );
});

t.teardown(() => {
    if (server) server.close();
});
