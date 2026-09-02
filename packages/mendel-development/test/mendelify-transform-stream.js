const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const Module = require('node:module');
const through2 = require('../../../node_modules/through2');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'through2') return through2;
    return originalLoad.call(this, request, parent, isMain);
};
const mendelifyTransformStream = require('../mendelify-transform-stream');
Module._load = originalLoad;

test('hashes transformed source with SHA-1', async () => {
    const stream = mendelifyTransformStream([], {
        _external: [],
        _options: { basedir: process.cwd() },
        _expose: {},
    });
    const row = {
        deps: {},
        file: 'app.js',
        id: 'app.js',
        source: 'module.exports = 1;',
    };
    const result = new Promise((resolve, reject) => {
        stream.once('data', resolve);
        stream.once('error', reject);
    });

    stream.end(row);

    assert.equal(
        (await result).sha,
        crypto.createHash('sha1').update(row.source).digest('hex')
    );
});
