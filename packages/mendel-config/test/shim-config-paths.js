const t = require('tap');
const path = require('path');
const ShimConfig = require('../src/shim-config');

t.test('shim paths relativize without changing identity', (t) => {
    const projectRoot = path.resolve('/proj/app');
    const result = ShimConfig({
        projectRoot,
        shim: {},
        defaultShim: {
            inside: path.resolve('/proj/app/node_modules/x/index.js'),
            // a daemon installed outside the consumer project (workspace
            // symlink, global install) resolves shims above projectRoot;
            // "./" + "../…" would mint a second spelling of the same file
            outside: path.resolve('/proj/daemon/node_modules/y/index.js'),
            skipped: false,
        },
    });

    t.equal(result.inside, './node_modules/x/index.js');
    t.equal(result.outside, '../daemon/node_modules/y/index.js');
    t.equal(result.skipped, false);
    t.end();
});
