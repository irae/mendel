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
