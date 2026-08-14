const tap = require('tap');
const path = require('path');
const { baseYaml, stageFixture, runBuild } = require('./helpers');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/parser-project'),
    'parser-coverage-main-runtime'
);

/**
 * Functional regression: dev builds with `runtime: main` (SSR configuration)
 * must also enforce parser coverage. An unparsed file required into a main-runtime
 * bundle is a syntax error at Node evaluation time (whether via require() or vm),
 * just as in browser bundles.
 */
tap.test(
    'dev build errors when a required file has no configured parser (main runtime)',
    function (t) {
        t.plan(3);

        const yaml = baseYaml({
            entry: 'index.js',
            bundleExtra: '    runtime: main',
        });

        runBuild(appPath, yaml, (error) => {
            t.ok(error, 'build fails instead of silently bundling raw text');
            t.match(
                error.message,
                /notes\.md/,
                'names the file that was required'
            );
            t.match(
                error.message,
                /mendel-parser-plaintext/,
                'names the package that resolves it'
            );
            setImmediate(() => process.exit(t.passing() ? 0 : 1));
        });
    }
);
