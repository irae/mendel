/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var tap = require('tap');
var express = require('express');
var path = require('path');
var async = require('async');
// Without sync, rest of the test that relies on built app
// should not execute.
var exec = require('child_process').execSync;

var appPath = path.join(__dirname, './app-samples/1/');
var host = 'http://localhost:1337';
var appBundle = '/mendel/bWVuZGVsAQEA_wUAbddjTtQONPBGmb28yZdfmFFI58c/app.js';

var sut = require('../packages/mendel-middleware');

/***************************
 * TESTS were written for mendel v1 manifest
 * the mendel-core/app-samples/ are likely the same, so refactoring .mendelrc
 * while keeping the tests unchanged likely will be enought to pass
 ****************************/

// Before creating an application using the mendel-middleware, create a manifest
// by building first.
tap.skip('run build first', function (t) {
    t.plan(1);

    try {
        exec('./run.sh', { cwd: appPath });
        t.pass();
    } catch (error) {
        t.bailout('should create manifest but failed', error);
    }
});

var app = express();

app.use(
    sut({
        basedir: appPath,
    })
);

var server = app.listen('1337');
tap.tearDown(function () {
    server.close(process.exit);
});

app.get('/getURL_testA', function (req, res) {
    req.mendel.setVariations(['test_A']);
    // this lines force that only the first setVariations is accounted for
    // also increase coverage meaninfully
    req.mendel.setVariations(['test_C']);
    res.json({
        appBundle: req.mendel.getURL('app'),
    });
});

tap.skip('getURL returns correct hash', async function (t) {
    t.plan(2);

    try {
        const response = await fetch(host + '/getURL_testA');
        const json = await response.json();

        t.match(
            { statusCode: response.status },
            {
                statusCode: 200,
            },
            'getURL without errors'
        );
        t.match(
            json,
            {
                appBundle: appBundle,
            },
            'getURL correct hash'
        );
    } catch (error) {
        t.bailout(error);
    }
});

app.get('/getURLDeprecated', function (req, res) {
    res.json({
        appBundle: req.mendel.getURL('app', ['test_A']),
    });
});

tap.skip('getURL still works with variations', async function (t) {
    t.plan(3);

    var old = console.warn;
    var msg = null;
    console.warn = function (a) {
        msg = a;
    };

    try {
        const response = await fetch(host + '/getURLDeprecated');
        const json = await response.json();
        console.warn = old;

        t.match(
            { statusCode: response.status },
            {
                statusCode: 200,
            },
            'serves javascript'
        );
        t.match(json, {
            appBundle: appBundle,
        });
        t.contains(msg, '[DEPRECATED]', 'getURL show deprecated msg');
    } catch (error) {
        console.warn = old;
        t.bailout(error);
    }
});

app.get('/resolver_testA', function (req, res) {
    req.mendel.setVariations(['test_A']);
    res.json({
        result: req.mendel.resolver(['app']).require('index.js')(),
    });
});

tap.skip('resolver require gets correct code', async function (t) {
    t.plan(2);

    try {
        const response = await fetch(host + '/resolver_testA');
        const json = await response.json();

        t.match(
            { statusCode: response.status },
            { statusCode: 200 },
            'resolver without errors'
        );
        t.match(json.result, -2, 'resolver with correct content');
    } catch (error) {
        t.bailout(error);
    }
});

app.get('/resolverDeprecated', function (req, res) {
    res.json({
        result: req.mendel.resolver(['app'], ['test_A']).require('index.js')(),
    });
});

tap.skip('resolver still works with variations', async function (t) {
    t.plan(3);

    var old = console.warn;
    var msg = null;
    console.warn = function (a) {
        msg = a;
    };

    try {
        const response = await fetch(host + '/resolverDeprecated');
        const json = await response.json();
        console.warn = old;

        t.match(
            { statusCode: response.status },
            { statusCode: 200 },
            'serves javascript'
        );
        t.match(json.result, -2, 'resolver with correct content');
        t.contains(msg, '[DEPRECATED]', 'resolver show deprecated message');
    } catch (error) {
        console.warn = old;
        t.bailout(error);
    }
});

app.get('/getBundleIncorrect', function (req, res) {
    try {
        req.mendel.getBundle('app'); // this line throws
    } catch (e) {
        res.status(500).json({
            error: e.message,
        });
        return;
    }
    res.json({ unreachable: 'prop' });
});

tap.skip('throws on incorrect use', async function (t) {
    t.plan(2);

    try {
        const response = await fetch(host + '/getBundleIncorrect');
        const json = await response.json();

        t.match(
            { statusCode: response.status },
            {
                statusCode: 500,
            },
            'serves javascript'
        );
        t.match(
            json,
            {
                error: 'Please call req.mendel.setVariations first',
            },
            'throws error when called in wrong order'
        );
    } catch (error) {
        t.bailout(error);
    }
});

app.get('/getBundleCacheLoop', function (req, res) {
    var fail = false;
    var timer = setTimeout(function () {
        fail = true;
        res.sendStatus(500);
    }, 1000);

    req.mendel.setVariations(['test_A']);

    function doIt(done) {
        req.mendel.getBundle('app');
        done();
    }

    var calls = [doIt];
    for (var i = 0; i < 1000; i++) {
        calls.push(doIt);
    }
    async.series(calls, function () {
        if (!fail) {
            clearTimeout(timer);
            res.sendStatus(200);
        }
    });
});

tap.skip('getBundle cached per request', async function (t) {
    t.plan(1);

    try {
        const response = await fetch(host + '/getBundleCacheLoop');

        t.equal(response.status, 200, 'looks cached based on timer');
    } catch (error) {
        t.bailout(error);
    }
});
