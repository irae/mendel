/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var tap = require('tap');
var path = require('path');

var resolveInDirs = require('../resolve-dirs');

var appDir = path.resolve(
    __dirname,
    '../../mendel-core/test',
    './app-samples/1/'
);

tap.test('With defaults', function (t) {
    t.plan(2);

    process.chdir(appDir);
    resolveInDirs('./math', ['app'], false, false, function (err, path) {
        t.equal(err, null, 'able to find relative to process');
        t.match(path, '/1/app/math.js', 'looks inside dirs param');
    });
});

tap.test('With full params', function (t) {
    t.plan(5);

    process.chdir(__dirname);
    resolveInDirs(
        './math',
        ['test_A', 'app'],
        appDir,
        false,
        function (err, path) {
            t.error(err);
            t.match(path, '/1/test_A/math.js', 'finds in first directory');
        }
    );
    resolveInDirs(
        './math',
        ['test_B', 'app'],
        appDir,
        false,
        function (err, path) {
            t.error(err);
            t.match(path, '/1/app/math.js', "skips directory that don't exist");
        }
    );
    resolveInDirs(
        './math',
        ['unexisting1', 'unexisting2'],
        appDir,
        false,
        function (err) {
            t.match(
                err.message,
                'Cannot find module',
                "skips directory that don't exist"
            );
        }
    );
});
