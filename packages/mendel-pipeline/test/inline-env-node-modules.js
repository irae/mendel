const tap = require('tap');
const path = require('path');
const fs = require('fs');
const { stageFixture } = require('./helpers');

const monorepoPackages = path.resolve(__dirname, '../..');
const outletManifest = path.join(monorepoPackages, 'mendel-outlet-manifest');
const nodeModulesGen = path.join(
    monorepoPackages,
    'mendel-generator-node-modules'
);
const inlineEnv = path.join(monorepoPackages, 'mendel-transform-inline-env');

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/node-modules-project'),
    'inline-env-node-modules'
);
const appBuildPath = path.join(appPath, 'build');
const mendelrcPath = path.join(appPath, '.inline-env.mendelrc');

function writeMendelrc() {
    const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

transforms:
  inline-environment-variables:
    plugin: ${inlineEnv}

types:
  js:
    extensions:
      - .js
    include-node_modules: true
    transforms:
      - inline-environment-variables

outlets:
  - id: manifest
    plugin: ${outletManifest}
    options:
      uglify: false
      envify: false

generators:
  - id: node-modules-generator
    plugin: ${nodeModulesGen}

bundles:
  main:
    outlet: manifest
    manifest: main.manifest.json
    entries:
      - ./inline-env-router.js
  vendor:
    outlet: manifest
    manifest: vendor.manifest.json
    generator: node-modules-generator
    from:
      - main
`;
    fs.writeFileSync(mendelrcPath, yaml);
}

// react-router@7 reads process.env.hasOwnProperty("IS_RR_BUILD_REQUEST");
// the inliner used to turn the inherited function into a node and Babel threw
// "don't know how to turn this value into a node", failing the whole build.
tap.test(
    'inline-env transform builds node_modules calling process.env.hasOwnProperty',
    function (t) {
        t.plan(4);
        writeMendelrc();

        const prevCwd = process.cwd();
        process.chdir(appPath);
        process.env.MENDELRC = '.inline-env.mendelrc';
        process.env.MENDEL_TEST_ROUTER_MODE = 'inlined-mode';
        delete process.env.IS_RR_BUILD_REQUEST;
        delete process.env.NODE_ENV;
        delete process.env.MENDEL_ENV;

        delete require.cache[require.resolve('../')];
        const MendelV2 = require('../');
        const mendel = new MendelV2();

        const finish = (error) => {
            process.chdir(prevCwd);
            try {
                if (error) {
                    return t.bailout('inline-env sample build failed', error);
                }

                const vendorPath = path.join(
                    appBuildPath,
                    'vendor.manifest.json'
                );
                t.ok(fs.existsSync(vendorPath), 'writes vendor.manifest.json');

                delete require.cache[require.resolve(vendorPath)];
                const vendor = require(vendorPath);
                const routerKey = Object.keys(vendor.indexes).find((k) =>
                    /fake-router[/\\]dist[/\\]index\.js$/.test(k)
                );
                const source = routerKey
                    ? String(
                          vendor.bundles[vendor.indexes[routerKey]].data[0]
                              .source
                      )
                    : '';

                t.match(
                    source,
                    /process\.env\.hasOwnProperty\("IS_RR_BUILD_REQUEST"\)/,
                    'inherited hasOwnProperty stays a runtime call'
                );
                t.match(
                    source,
                    /undefined === "yes"/,
                    'unset IS_RR_BUILD_REQUEST still inlines to undefined'
                );
                t.match(
                    source,
                    /exports\.mode = "inlined-mode"/,
                    'set env vars are still inlined'
                );
            } finally {
                if (typeof mendel.onForceExit === 'function') {
                    try {
                        mendel.onForceExit();
                    } catch (e) {
                        /* ignore */
                    }
                }
                setImmediate(() => process.exit(t.passing() ? 0 : 1));
            }
        };

        mendel.run(finish);
    }
);
