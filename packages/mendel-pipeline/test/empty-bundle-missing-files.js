const tap = require('tap');
const path = require('path');
const { stageFixture, runBuild } = require('./helpers');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/error-project'),
    'empty-bundle-missing-files'
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
      - './does-not-exist.js'
`;

/**
 * Functional regression: an entry glob that matches nothing (a typo, a
 * deleted file) resolves to zero modules just like an all-negative-glob
 * bundle. The same generic check must catch it, not just the negative-glob
 * case.
 */
tap.test(
    'dev build errors when a bundle entry matches no existing file',
    function (t) {
        t.plan(3);

        runBuild(appPath, yaml, (error) => {
            t.ok(error, 'build fails instead of writing an empty bundle');
            t.match(error.message, /"main"/, 'names the bundle');
            t.match(
                error.message,
                /does-not-exist\.js/,
                'names the configured entries'
            );
            setImmediate(() => process.exit(t.passing() ? 0 : 1));
        });
    }
);
