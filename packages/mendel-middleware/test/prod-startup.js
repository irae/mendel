var tap = require('tap');
var path = require('path');
var MendelMiddleware = require('../');
var parseConfig = require('../../mendel-config');

var fixture = path.resolve(__dirname, './fixtures/prod-startup');
var origEnv = process.env.NODE_ENV;

tap.teardown(function () {
    process.env.NODE_ENV = origEnv;
});

process.env.NODE_ENV = 'production';

tap.test(
    'production middleware starts without transform packages',
    function (t) {
        t.throws(
            function () {
                parseConfig.devConfig({ projectRoot: fixture });
            },
            /mendel-transform-not-installed/,
            'build parse still requires the missing transform'
        );

        var handle;
        t.doesNotThrow(function () {
            handle = MendelMiddleware({ projectRoot: fixture });
        }, 'production middleware constructs');

        var req = { url: '/' };
        handle(req, {}, function () {});
        req.mendel.setVariations([]);
        t.match(
            req.mendel.getURL('main'),
            /^\/mendel\/.+\/main/,
            'serves a hashed URL from the prebuilt manifest'
        );
        t.end();
    }
);
