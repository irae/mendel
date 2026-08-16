const tap = require('tap');
const MendelCache = require('../src/cache');

function makeCache() {
    return new MendelCache({
        projectRoot: '/tmp/mendel-normalized-id',
        environment: 'development',
        baseConfig: { id: 'base', dir: './app' },
        variationConfig: {
            variations: [
                { id: 'bucket_A', chain: ['variations/bucket_A', 'app'] },
            ],
        },
        shim: {},
        types: [],
        ignores: [],
    });
}

/**
 * Unit: normalizedId strips the variation prefix and extension from file
 * ids, but an id that ends exactly at the variation directory has no file
 * component and must pass through unchanged instead of collapsing to './.'.
 */
/**
 * Unit: "process" and "node:process" alias the same shim file. The file's
 * normalizedId must stay the unprefixed id — mendel-outlet-browser-pack
 * keys its global prelude (`var process=...`) on deps resolving to exactly
 * "process", so an alias winning the map would silently drop the prelude.
 */
tap.test('shim aliases sharing a file keep the first id', (t) => {
    const cache = new MendelCache({
        projectRoot: '/tmp/mendel-normalized-id',
        environment: 'development',
        baseConfig: { id: 'base', dir: './app' },
        variationConfig: { variations: [] },
        shim: {
            process: './node_modules/shims/process.js',
            'node:process': './node_modules/shims/process.js',
        },
        types: [],
        ignores: [],
    });

    t.equal(
        cache.getNormalizedId('./node_modules/shims/process.js'),
        'process',
        'shim file normalizes to the unprefixed shim id'
    );
    t.equal(
        cache.getNormalizedId('node:process'),
        'node:process',
        'prefixed literal still normalizes to itself'
    );
    t.equal(
        cache.getNormalizedId('process'),
        'process',
        'unprefixed literal normalizes to itself'
    );

    t.end();
});

tap.test('getNormalizedId around the variation-dir boundary', (t) => {
    const cache = makeCache();

    t.equal(
        cache.getNormalizedId('./variations/bucket_A/button.js'),
        './button',
        'variation file id loses prefix and extension'
    );
    t.equal(
        cache.getNormalizedId('./variations/bucket_A/foo/index.js'),
        './foo',
        'index file id normalizes to its directory'
    );
    t.equal(
        cache.getNormalizedId('./variations/bucket_A'),
        './variations/bucket_A',
        'bare variation-dir id stays unchanged'
    );

    t.end();
});
