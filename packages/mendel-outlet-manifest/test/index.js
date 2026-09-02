/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

const tap = require('tap');
const crypto = require('crypto');
const ManifestOutlet = require('../src/index');

function sha1(source) {
    return crypto.createHash('sha1').update(source).digest('hex');
}

tap.test('dataFromItem records a sha1 digest of the source', (t) => {
    const outlet = new ManifestOutlet({
        baseConfig: { dir: 'base' },
    });
    const item = {
        normalizedId: 'entry.js',
        id: 'entry.js',
        deps: { './dep': { browser: '../dep.browser.js' } },
        variation: 'experiment',
        source: 'module.exports = 42;',
        entry: true,
        order: 3,
    };

    const data = outlet.dataFromItem(item);

    t.equal(data.sha, sha1(item.source), 'sha matches sha1 of the source');
    t.equal(data.id, item.normalizedId, 'id is the normalized id');
    t.equal(data.deps['./dep'], '../dep.browser.js', 'deps picked per runtime');
    t.equal(data.variation, 'experiment', 'variation preserved');
    t.equal(data.source, item.source, 'source preserved');
    t.equal(data.entry, true, 'entry flag preserved');
    t.equal(data.order, 3, 'order preserved');
    t.end();
});

tap.test('dataFromItem falls back to the base dir variation', (t) => {
    const outlet = new ManifestOutlet({
        baseConfig: { dir: 'base' },
    });
    const data = outlet.dataFromItem({
        normalizedId: 'entry.js',
        id: 'entry.js',
        deps: {},
        source: 'module.exports = 1;',
    });

    t.equal(data.variation, 'base', 'base dir used when no variation set');
    t.equal(data.sha, sha1('module.exports = 1;'), 'sha still computed');
    t.end();
});
