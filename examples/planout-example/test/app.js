var tap = require('tap');
var http = require('http');

function stubMendelMiddleware() {
    return function () {
        return function (req, res, next) {
            req.mendel = {
                isSsrReady: function () {
                    return false;
                },
                getURL: function () {
                    return '';
                },
            };
            next();
        };
    };
}

['mendel-development-middleware', 'mendel-middleware'].forEach(function (name) {
    var resolved = require.resolve(name);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: stubMendelMiddleware(),
    };
});

var app = require('../app.js');

var UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function visitorIdFrom(res) {
    var cookies = (res.headers['set-cookie'] || []).map(function (cookie) {
        return cookie.split(';')[0];
    });
    var match = cookies.filter(function (cookie) {
        return cookie.indexOf('visitorId=') === 0;
    });
    return match.length ? match[0].slice('visitorId='.length) : null;
}

tap.test('app assigns and keeps a visitorId', function (t) {
    var server = app.listen(0, function () {
        var port = server.address().port;
        var opts = {
            host: '127.0.0.1',
            port: port,
            path: '/?variations=layer_1_bucket_A&ssr=false',
        };
        t.plan(3);

        http.get(opts, function (res) {
            t.equal(res.statusCode, 200, 'serves the index page');
            var visitorId = visitorIdFrom(res);
            t.match(visitorId, UUID, 'fresh request gets a uuid visitorId');

            http.get(
                Object.assign({}, opts, {
                    headers: { cookie: 'visitorId=' + visitorId },
                }),
                function (res) {
                    t.equal(
                        visitorIdFrom(res),
                        visitorId,
                        'existing visitorId cookie is kept'
                    );
                    server.close();
                }
            );
        });
    });
});
