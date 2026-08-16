const { test } = require('tap');
const transform = require('../');

test('inlines process.env reads', (t) => {
    process.env.MENDEL_TEST_INLINE = 'inlined-value';
    const { source } = transform({
        source: 'module.exports = process.env.MENDEL_TEST_INLINE;',
        filename: 'a.js',
        map: null,
    });
    delete process.env.MENDEL_TEST_INLINE;

    t.match(source, /"inlined-value"/);
    t.notMatch(source, /process\.env/);
    t.end();
});

test('passes through source without process.env', (t) => {
    const input = 'module.exports = 1;';
    const { source, map } = transform({
        source: input,
        filename: 'a.js',
        map: null,
    });
    t.equal(source, input);
    t.equal(map, null);
    t.end();
});

test('delete process.env.X stays valid strict-mode code', (t) => {
    // debug/src/node.js does exactly this; the raw inliner plugin would
    // rewrite the member expression into `delete undefined` (unset var)
    // or `delete "literal"` — the former is a strict-mode syntax error
    // that only explodes at the next parse (e.g. minification).
    delete process.env.MENDEL_TEST_DELETED;
    const { source } = transform({
        source: [
            '"use strict";',
            'function save(ns) {',
            '    if (ns) process.env.MENDEL_TEST_DELETED = ns;',
            '    else delete process.env.MENDEL_TEST_DELETED;',
            '}',
            'module.exports = save;',
        ].join('\n'),
        filename: 'node.js',
        map: null,
    });

    t.notMatch(source, /delete undefined/);
    t.doesNotThrow(() => new Function(source));
    t.end();
});
