const tap = require('tap');
const fs = require('fs');
const path = require('path');
const {
    baseYaml,
    runBuild,
    buildPathFor,
} = require('./parser-coverage-helpers');

const appPath = path.resolve(__dirname, './parser-coverage-production-samples');

/**
 * This check is dev-only by design: production builds must not change
 * behavior even for a file mendel still doesn't know how to parse.
 */
tap.test(
    'production build does not fire even without a configured parser',
    function (t) {
        t.plan(2);

        const yaml = baseYaml({
            entry: 'index.js',
            extraTop: 'environment: production\n',
        });

        runBuild(appPath, yaml, (error) => {
            t.notOk(error, 'production build is left unchanged by this check');
            t.ok(
                fs.existsSync(
                    path.join(buildPathFor(appPath), 'main.manifest.json')
                ),
                'writes main.manifest.json'
            );
            setImmediate(() => process.exit(t.passing() ? 0 : 1));
        });
    }
);
