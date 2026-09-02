const { test } = require('tap');
const crypto = require('crypto');
const ManifestOutlet = require('../src');

test('dataFromItem hashes item source into sha', (t) => {
    const outlet = new ManifestOutlet(
        { baseConfig: { dir: '/app' } },
        { runtime: 'browser' }
    );
    const source = 'console.log(1);';
    const data = outlet.dataFromItem({
        id: '/app/main.js',
        normalizedId: './main.js',
        deps: {},
        file: '/app/main.js',
        source,
    });

    t.equal(data.id, './main.js');
    t.equal(
        data.sha,
        crypto.createHash('sha1').update(source).digest('hex'),
        'sha is the hex sha1 digest of the source'
    );
    t.end();
});
