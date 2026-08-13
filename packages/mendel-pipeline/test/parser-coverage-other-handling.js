const tap = require('tap');
const fs = require('fs');
const path = require('path');
const {
    baseYaml,
    runBuild,
    buildPathFor,
} = require('./parser-coverage-helpers');

const appPath = path.resolve(
    __dirname,
    './parser-coverage-other-handling-samples'
);

/**
 * .txt has a first-party plaintext-parser suggestion, but a project can
 * legitimately cover it another way (here: a glob-declared resource type
 * with no parser at all). The project's own type coverage must win over
 * the hint table, or this check would break working builds.
 */
tap.test(
    'dev build does not fire for an extension handled another way (glob-declared resource type)',
    function (t) {
        t.plan(2);

        const yaml = baseYaml({
            types: `  text:
    glob:
      - '**/*.txt'
    resource: true`,
            entry: 'index-other-handling.js',
        });

        runBuild(appPath, yaml, (error) => {
            t.notOk(
                error,
                'build succeeds; the project already declared coverage for .txt'
            );
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
