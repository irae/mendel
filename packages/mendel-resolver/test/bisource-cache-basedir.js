const { test } = require('tap');
const path = require('path');
const BisourceResolver = require('../bisource-resolver');

const fixtureDir = path.resolve(__dirname, './fixtures/nested-dup');
// resolver output is relativized against cwd twice; results are only
// stable when process.cwd() matches the resolver cwd
process.chdir(fixtureDir);

function createResolver(cache) {
    return new BisourceResolver({
        cwd: fixtureDir,
        basedir: fixtureDir,
        projectRoot: fixtureDir,
        baseConfig: { dir: './src/base' },
        variationConfig: { variations: [], allDirs: [] },
        runtimes: ['main', 'browser'],
        cache,
        has: () => false,
    });
}

/**
 * Unit: the resolution cache must be keyed per basedir. A bare npm name
 * resolves to the NEAREST node_modules, so two files can legitimately get
 * two different copies of the same package (nested duplicate installs).
 * A name-only key let the first requiring file poison the cache: dep
 * edges then disagreed across deps workers and karma-served module maps
 * pointed at ids that were never served (MODULE_NOT_FOUND in the page).
 */
test('bare-name resolution is cached per basedir, not per name', (t) => {
    const cache = new Map();
    const resolver = createResolver(cache);

    resolver.setBaseDir(path.join(fixtureDir, 'node_modules/consumer-a'));
    return resolver
        .resolve('dep')
        .then((fromNested) => {
            t.match(
                fromNested.main,
                /consumer-a\/node_modules\/dep/,
                'consumer-a gets its nested copy'
            );
            resolver.setBaseDir(
                path.join(fixtureDir, 'node_modules/consumer-b')
            );
            return resolver.resolve('dep');
        })
        .then((fromRoot) => {
            t.equal(
                fromRoot.main,
                './node_modules/dep/index.js',
                'consumer-b gets the hoisted root copy despite the warm cache'
            );
        });
});
