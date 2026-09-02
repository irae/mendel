/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var t = require('tap');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var through2Path = require.resolve('through2');
var originalThrough2 = require.cache[through2Path];

function sha1(source) {
    return crypto.createHash('sha1').update(source).digest('hex');
}

function FakeThrough() {
    EventEmitter.call(this);
    this.rows = [];
}
FakeThrough.prototype = Object.create(EventEmitter.prototype);
FakeThrough.prototype.push = function (row) {
    this.rows.push(row);
    this.emit('data', row);
};
FakeThrough.prototype.end = function (row) {
    this.transform.call(this, row, null, function () {
        this.emit('end');
    });
};

function stubThrough2(transform) {
    var fake = new FakeThrough();
    fake.transform = transform;
    require.cache[through2Path] = {
        id: through2Path,
        filename: through2Path,
        loaded: true,
        exports: {
            obj: function (options, transform) {
                if (typeof options === 'function') {
                    transform = options;
                }
                fake.transform = transform;
                return fake;
            },
        },
    };
    return fake;
}

function restoreThrough2() {
    if (originalThrough2) {
        require.cache[through2Path] = originalThrough2;
    } else {
        delete require.cache[through2Path];
    }
}

function runThrough(row, variations, bundle) {
    return new Promise(function (resolve) {
        var fake = stubThrough2();
        delete require.cache[require.resolve('../mendelify-transform-stream')];
        var mendelifyTransformStream = require('../mendelify-transform-stream');
        var stream = mendelifyTransformStream(
            variations || [],
            bundle || {
                _external: [],
                _options: { basedir: '/basedir' },
            }
        );
        t.after(restoreThrough2);
        stream.on('data', function (data) {
            resolve(data);
        });
        stream.end(row);
        fake.emit('end');
    });
}

t.test('assigns a sha1 digest of the row source', function (t) {
    var row = {
        file: '/basedir/index.js',
        id: 'index.js',
        source: 'var a = require("foo");',
        deps: {},
        expose: false,
    };

    runThrough(row).then(function (output) {
        t.equal(
            output.sha,
            sha1(output.source),
            'sha matches sha1 of the emitted source'
        );
        t.end();
    });
});

t.test('hashes the rewritten source after the require transform', function (t) {
    var variations = [{ chain: ['variations'] }];
    var row = {
        file: '/basedir/variations/foo.js',
        id: 'variations/foo.js',
        source: ['var foo = require("./foo");', 'console.log(foo);'].join('\n'),
        deps: {},
        expose: false,
    };

    runThrough(row, variations, {
        _external: [],
        _options: { basedir: '/basedir' },
    }).then(function (output) {
        t.equal(output.variation, 'variations', 'variation dir is tracked');
        t.equal(
            output.sha,
            sha1(output.source),
            'sha is computed over the rewritten source'
        );
        t.end();
    });
});
