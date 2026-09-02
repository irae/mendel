/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var path = require('path');
var test = require('tap').test;
var applyExtraOptions = require('../apply-extra-options');

test('resolves ignore, exclude and external globs', function (t) {
    var seen = [];
    var ready;
    var b = {
        _pending: 0,
        ignore: function (file) {
            seen.push('ignore:' + file);
        },
        exclude: function (file) {
            seen.push('exclude:' + file);
        },
        external: function (file) {
            seen.push('external:' + file);
        },
        emit: function (event) {
            if (event === '_ready') ready();
        },
    };

    applyExtraOptions(b, {
        ignore: [path.join(__dirname, '*.js')],
        exclude: [path.join(__dirname, 'definitely-missing-*.js')],
        external: [path.join(__dirname, '**', '*.js')],
    });

    new Promise(function (resolve, reject) {
        ready = resolve;
        setTimeout(reject, 2000, new Error('globs never resolved'));
    }).then(function () {
        t.ok(
            seen.some(function (entry) {
                return entry.indexOf('ignore:') === 0 && entry.endsWith('.js');
            }),
            'ignore glob resolves to matching files'
        );
        t.ok(
            seen.indexOf(
                'exclude:' + path.join(__dirname, 'definitely-missing-*.js')
            ) !== -1,
            'unmatched exclude falls back to the raw pattern'
        );
        t.ok(
            seen.some(function (entry) {
                return (
                    entry.indexOf('external:') === 0 && entry.endsWith('.js')
                );
            }),
            'external glob resolves to matching files'
        );
        t.end();
    });
});
