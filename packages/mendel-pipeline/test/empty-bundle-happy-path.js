const tap = require('tap');
const fs = require('fs');
const path = require('path');
const { stageFixture, runBuild, buildPathFor } = require('./helpers');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/error-project'),
    'empty-bundle-happy-path'
);

const outletManifest = path.resolve(__dirname, '../../mendel-outlet-manifest');

const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

transforms: {}

types:
  js:
    extensions:
      - .js

outlets:
  - id: manifest
    plugin: ${outletManifest}
    options:
      uglify: false
      envify: false

bundles:
  main:
    outlet: manifest
    manifest: main.manifest.json
    entries:
      - './main.js'
`;

/**
 * Companion to empty-bundle-negative-globs.js and empty-bundle-missing-files.js:
 * a bundle whose entries resolve to real modules must build normally, so the
 * new empty-bundle check must not become a false positive.
 */
tap.test(
    'dev build succeeds when a bundle resolves to a non-empty entry set',
    function (t) {
        t.plan(2);

        runBuild(appPath, yaml, (error) => {
            t.notOk(error, 'build succeeds with resolvable entries');
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
