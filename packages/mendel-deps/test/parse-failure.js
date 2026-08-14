const test = require('tap').test;
const deps = require('../');

test('recovers gracefully from a parse failure instead of throwing', (t) => {
    const resolver = { resolve: () => Promise.reject() };

    return deps({
        file: 'broken.css',
        source: '}}} not valid css {{{',
        resolver,
    }).then((importMap) => {
        t.same(importMap, {}, 'no imports recorded for the unparseable file');
    });
});
