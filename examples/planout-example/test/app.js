/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var http = require('http');
var tap = require('tap');

// The Mendel middlewares need a running builder (IPC), which a unit test
// cannot provide, so they are stubbed out: only the visitor-id middleware
// is under test here.
['mendel-middleware', 'mendel-development-middleware'].forEach(function (name) {
    require.cache[require.resolve(name)] = {
        exports: function () {
            return function (req, res, next) {
                req.mendel = req.mendel || {
                    isSsrReady: function () {
                        return false;
                    },
                    getURL: function (bundle) {
                        return '/mendel/' + bundle;
                    },
                };
                next();
            };
        },
    };
});

var app = require('../app.js');

var uuidv4Re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var returningVisitorId = '8417bb0e-d918-4807-b9a3-0339c6300d4f';

function visitorIdCookie(res) {
    var setCookies = res.headers['set-cookie'] || [];
    for (var i = 0; i < setCookies.length; i++) {
        if (setCookies[i].indexOf('visitorId=') === 0) {
            return setCookies[i].split(';')[0].slice('visitorId='.length);
        }
    }
    return null;
}

tap.test('visitor-id', function (t) {
    t.plan(3);

    var server = app.listen(0);
    t.after(function () {
        server.closeAllConnections();
        server.close();
    });

    // A path with no route: the visitor-id middleware still runs, and the
    // request stays away from the SSR route.
    function request(cookieHeader) {
        return new Promise(function (resolve) {
            var req = http.get(
                {
                    port: server.address().port,
                    path: '/visitor-id-probe',
                    headers: cookieHeader ? { cookie: cookieHeader } : {},
                },
                resolve
            );
            req.on('error', resolve);
        });
    }

    var listening = new Promise(function (resolve) {
        server.once('listening', resolve);
    });

    listening
        .then(function () {
            return request();
        })
        .then(function (res) {
            t.equal(res.statusCode, 404, 'no route, middleware still runs');
            t.ok(
                uuidv4Re.test(visitorIdCookie(res) || ''),
                'visitors without a cookie get a uuid v4'
            );
            return request('visitorId=' + returningVisitorId);
        })
        .then(function (res) {
            t.equal(
                visitorIdCookie(res),
                returningVisitorId,
                'the cookie visitorId is kept'
            );
        });
});
