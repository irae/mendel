const tap = require('tap');
const path = require('path');
const { stageFixture, runBuild } = require('./helpers');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/error-project'),
    'empty-bundle-negative-globs'
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
      - '!./main.js'
`;

/**
 * Functional regression: a bundle whose entries are all negative globs never
 * has a positive glob to walk from, so it silently resolves to zero modules.
 * The build must fail loudly and name the bundle and its configured entries.
 */
tap.test(
    'dev build errors when a bundle only has negative-glob entries',
    function (t) {
        t.plan(3);

        runBuild(appPath, yaml, (error) => {
            t.ok(error, 'build fails instead of writing an empty bundle');
            t.match(error.message, /"main"/, 'names the bundle');
            t.match(
                error.message,
                /!\.\/main\.js/,
                'names the configured entries'
            );
            setImmediate(() => process.exit(t.passing() ? 0 : 1));
        });
    }
);
