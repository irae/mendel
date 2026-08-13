/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var tap = require('tap');
var sut = require('../packages/mendel-development-middleware');

var express = require('express');
var path = require('path');
var async = require('async');

var app = express();
app.use(
    sut({
        basedir: path.join(__dirname, './app-samples/1/'),
    })
);

var server = app.listen('1337');
var host = 'http://localhost:1337';
var appBundle = host + '/mendel/app/app.js';
tap.teardown(function () {
    server.close(process.exit);
});

tap.test('mendel-development-middleware serves a bundle', async function (t) {
    t.plan(2);

    try {
        const response = await fetch(appBundle);
        const body = await response.text();

        t.match(
            {
                statusCode: response.status,
                headers: {
                    'content-type': response.headers.get('content-type'),
                },
            },
            {
                statusCode: 200,
                headers: { 'content-type': 'application/javascript' },
            },
            'serves javascript'
        );
        t.has(
            body,
            'sourceMappingURL=data:application/json;',
            'has source maps'
        );
    } catch (error) {
        t.bailout(error);
    }
});

tap.test('serves cached bundles', async function (t) {
    t.plan(1);

    async function getVendor() {
        const response = await fetch(appBundle);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    // this would cause test to timeout if cache is disabled
    var requests = [];
    for (var i = 0; i < 1000; i++) {
        requests.push(getVendor);
    }

    try {
        await new Promise((resolve, reject) => {
            async.series(requests, function (error) {
                if (error) reject(error);
                else resolve();
            });
        });
        t.pass('got 1000 of the same bundle');
    } catch (error) {
        t.bailout(error);
    }
});
