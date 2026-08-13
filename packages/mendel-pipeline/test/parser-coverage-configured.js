const tap = require('tap');
const fs = require('fs');
const path = require('path');
const {
    baseYaml,
    runBuild,
    buildPathFor,
    parserPlaintext,
} = require('./parser-coverage-helpers');

const appPath = path.resolve(__dirname, './parser-coverage-configured-samples');

/**
 * Companion to parser-coverage-missing.js: once the plaintext parser is
 * installed and configured for the extension, the same require() must
 * build cleanly, so this check must not become a false positive.
 */
tap.test(
    'dev build succeeds once the plaintext parser is installed and configured',
    function (t) {
        t.plan(2);

        const yaml = baseYaml({
            transforms: `  markdown-parse:
    plugin: ${parserPlaintext}`,
            types: `  markdown:
    extensions:
      - .md
    parser: markdown-parse
    parser-to-type: js`,
            entry: 'index.js',
        });

        runBuild(appPath, yaml, (error) => {
            t.notOk(error, 'build succeeds with the parser configured');
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
