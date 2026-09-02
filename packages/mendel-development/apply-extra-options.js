/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var path = require('path');
var { glob } = require('node:fs').promises;

module.exports = applyExtraOptions;

// Browserify's bundle() waits on `_ready` while `_pending` async work finishes.
// Honor that handshake for ignore/exclude/external globs so multi-bundle and
// extract-style pipelines do not race past unfinished path resolution.
function applyExtraOptions(b, options) {
    []
        .concat(options.ignore)
        .filter(Boolean)
        .forEach(function (i) {
            b._pending++;
            Array.fromAsync(glob(i))
                .then(function (files) {
                    if (files.length === 0) {
                        b.ignore(i);
                    } else {
                        files.forEach(function (file) {
                            b.ignore(file);
                        });
                    }
                    if (--b._pending === 0) b.emit('_ready');
                })
                .catch(function (err) {
                    b.emit('error', err);
                });
        });

    []
        .concat(options.exclude)
        .filter(Boolean)
        .forEach(function (u) {
            b.exclude(u);

            b._pending++;
            Array.fromAsync(glob(u))
                .then(function (files) {
                    files.forEach(function (file) {
                        b.exclude(file);
                    });
                    if (--b._pending === 0) b.emit('_ready');
                })
                .catch(function (err) {
                    b.emit('error', err);
                });
        });

    []
        .concat(options.external)
        .filter(Boolean)
        .forEach(function (x) {
            var xs = splitOnColon(x);
            if (xs.length === 2) {
                add(xs[0], { expose: xs[1] });
            } else if (/\*/.test(x)) {
                b.external(x);
                b._pending++;
                Array.fromAsync(glob(x))
                    .then(function (files) {
                        files.forEach(function (file) {
                            add(file, {});
                        });
                        if (--b._pending === 0) b.emit('_ready');
                    })
                    .catch(function (err) {
                        b.emit('error', err);
                    });
            } else add(x, {});

            function add(x, opts) {
                if (/^[/.]/.test(x)) b.external(path.resolve(x), opts);
                else b.external(x, opts);
            }
        });
}

function splitOnColon(f) {
    var pos = f.lastIndexOf(':');
    if (pos == -1) {
        return [f]; // No colon
    } else {
        if (/[a-zA-Z]:[\\/]/.test(f) && pos == 1) {
            return [f]; // Windows path and colon is part of drive name
        } else {
            return [f.substr(0, pos), f.substr(pos + 1)];
        }
    }
}
