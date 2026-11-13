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

const fs = require('fs');
const path = require('path');

const routerFixture = path.join(
    __dirname,
    'fixtures/react-router-build-time-header.js'
);

function runRouterFixture(t, envValue) {
    const prev = process.env.IS_RR_BUILD_REQUEST;
    if (envValue === undefined) delete process.env.IS_RR_BUILD_REQUEST;
    else process.env.IS_RR_BUILD_REQUEST = envValue;
    t.teardown(() => {
        if (prev === undefined) delete process.env.IS_RR_BUILD_REQUEST;
        else process.env.IS_RR_BUILD_REQUEST = prev;
    });
    return transform({
        source: fs.readFileSync(routerFixture, 'utf8'),
        filename: routerFixture,
        map: null,
    }).source;
}

test('react-router process.env.hasOwnProperty() is left as a runtime call', (t) => {
    // Babel threw "don't know how to turn this value into a node" when the
    // inliner tried to inline the inherited process.env.hasOwnProperty.
    const source = runRouterFixture(t, undefined);

    t.match(source, /process\.env\.hasOwnProperty\("IS_RR_BUILD_REQUEST"\)/);
    t.notMatch(source, /process\.env\.IS_RR_BUILD_REQUEST/);
    t.match(source, /undefined === "yes"/);
    t.end();
});

test('react-router fixture still inlines a set IS_RR_BUILD_REQUEST', (t) => {
    const source = runRouterFixture(t, 'yes');

    t.match(source, /process\.env\.hasOwnProperty\("IS_RR_BUILD_REQUEST"\)/);
    t.match(source, /"yes" === "yes"/);
    t.end();
});

test('inherited process.env members are never inlined', (t) => {
    const { source } = transform({
        source: [
            'a = process.env.toString();',
            'b = process.env["valueOf"]();',
            'c = process.env.constructor;',
            'd = process.env.__proto__;',
            'e = process.env.propertyIsEnumerable("X");',
        ].join('\n'),
        filename: 'inherited.js',
        map: null,
    });

    t.match(source, /process\.env\.toString\(\)/);
    t.match(source, /process\.env\["valueOf"\]\(\)/);
    t.match(source, /process\.env\.constructor/);
    t.match(source, /process\.env\.__proto__/);
    t.match(source, /process\.env\.propertyIsEnumerable\("X"\)/);
    t.end();
});

test('an env var shadowing an Object.prototype name is still inlined', (t) => {
    process.env.toString = 'shadowed';
    t.teardown(() => delete process.env.toString);
    const { source } = transform({
        source: 'module.exports = process.env.toString;',
        filename: 'shadow.js',
        map: null,
    });

    t.match(source, /"shadowed"/);
    t.end();
});

test('unset env vars still inline to undefined', (t) => {
    delete process.env.MENDEL_TEST_UNSET;
    const { source } = transform({
        source: 'module.exports = process.env.MENDEL_TEST_UNSET;',
        filename: 'unset.js',
        map: null,
    });

    t.match(source, /module\.exports = undefined;/);
    t.end();
});
