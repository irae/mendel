const tap = require('tap');
const path = require('path');
const { baseYaml, stageFixture, runBuild } = require('./helpers');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/parser-project'),
    'parser-coverage-missing'
);

/**
 * Functional regression: requiring a file whose extension has no configured
 * type/parser used to silently bundle the raw source as if it were JS.
 * Dev builds must now fail loudly and name the fix.
 */
tap.test(
    'dev build errors when a required file has no configured parser',
    function (t) {
        t.plan(3);

        const yaml = baseYaml({ entry: 'index.js' });

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
