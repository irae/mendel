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

tap.test('resolves the browser field over main', function (t) {
    t.plan(2);

    process.chdir(appDir);
    resolveInDirs(
        'browser-field-pkg',
        ['app'],
        false,
        false,
        function (err, path) {
            t.error(err);
            t.match(
                path,
                '/1/app/node_modules/browser-field-pkg/browser-entry.js',
                'uses the package.json browser field, not main'
            );
        }
    );
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

tap.test(
    'resolves from the first directory in the chain that has the file',
    function (t) {
        t.plan(2);

        process.chdir(__dirname);
        resolveInDirs(
            './math',
            ['test_A', 'app'],
            appDir,
            false,
            function (err, path) {
                t.error(err);
                t.match(
                    path,
                    '/1/test_A/math.js',
                    'earlier directory wins over a later one that also has the file'
                );
            }
        );
    }
);

tap.test(
    'reports a module-not-found error when no directory resolves',
    function (t) {
        t.plan(2);

        process.chdir(__dirname);
        resolveInDirs(
            './math',
            ['unexisting1', 'unexisting2'],
            appDir,
            false,
            function (err, path) {
                t.match(
                    err.message,
                    'unexisting2',
                    'error reflects the last directory tried, not the first'
                );
                t.notOk(path, 'no path is returned');
            }
        );
    }
);

tap.test('never invokes the callback more than once', function (t) {
    t.plan(2);

    process.chdir(__dirname);

    var foundCalls = 0;
    resolveInDirs('./math', ['test_A', 'app'], appDir, false, function () {
        foundCalls++;
        t.equal(foundCalls, 1, 'found path only invokes callback once');
    });

    var notFoundCalls = 0;
    resolveInDirs(
        './math',
        ['unexisting1', 'unexisting2'],
        appDir,
        false,
        function () {
            notFoundCalls++;
            t.equal(
                notFoundCalls,
                1,
                'not-found path only invokes callback once'
            );
        }
    );
});
