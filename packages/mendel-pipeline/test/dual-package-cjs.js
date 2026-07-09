const tap = require('tap');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

// Resolve monorepo plugins before chdir so config can use absolute plugin paths.
const monorepoPackages = path.resolve(__dirname, '../..');
const outletManifest = path.join(monorepoPackages, 'mendel-outlet-manifest');
const nodeModulesGen = path.join(
    monorepoPackages,
    'mendel-generator-node-modules'
);

const appPath = path.resolve(__dirname, './dual-package-samples');
const appBuildPath = path.join(appPath, 'build');
const mendelrcPath = path.join(appPath, '.dual.mendelrc');

function writeMendelrc() {
    const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

types:
  js:
    extensions:
      - .js
      - .cjs
      - .mjs
    include-node_modules: true

outlets:
  - id: manifest
    plugin: ${outletManifest}
    options:
      # keep raw source for assertions; uglify is orthogonal to .cjs deps
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
      - ./index.js
  vendor:
    outlet: manifest
    manifest: vendor.manifest.json
    generator: node-modules-generator
    from:
      - main
`;
    fs.writeFileSync(mendelrcPath, yaml);
}

tap.test(
    'production-style build keeps deps for dual-package .cjs main',
    function (t) {
        t.plan(5);
        writeMendelrc();
        rimraf.sync(appBuildPath);
        rimraf.sync(path.join(appPath, '.mendelipc'));
        fs.mkdirSync(appBuildPath, { recursive: true });

        const prevCwd = process.cwd();
        process.chdir(appPath);
        process.env.MENDELRC = '.dual.mendelrc';
        delete process.env.NODE_ENV;
        delete process.env.MENDEL_ENV;

        // Require after env is set; Mendel reads MENDELRC at construct time.
        delete require.cache[require.resolve('../')];
        const MendelV2 = require('../');
        const mendel = new MendelV2();

        const finish = (error) => {
            process.chdir(prevCwd);
            try {
                if (error) {
                    return t.bailout('dual-package sample build failed', error);
                }

                const vendorPath = path.join(
                    appBuildPath,
                    'vendor.manifest.json'
                );
                const mainPath = path.join(appBuildPath, 'main.manifest.json');
                t.ok(fs.existsSync(vendorPath), 'writes vendor.manifest.json');
                t.ok(fs.existsSync(mainPath), 'writes main.manifest.json');

                delete require.cache[require.resolve(vendorPath)];
                delete require.cache[require.resolve(mainPath)];
                const vendor = require(vendorPath);

                const cjsKey = Object.keys(vendor.indexes).find((k) =>
                    /fake-dual.*index\.cjs$/.test(k)
                );
                t.ok(
                    cjsKey,
                    'vendor indexes the dual-package CJS entry (.cjs), not only ESM'
                );

                const entry = vendor.bundles[vendor.indexes[cjsKey]];
                const data = entry.data[0];
                t.ok(
                    data.deps && data.deps['helper-lib'],
                    'CJS entry records require("helper-lib") in deps (regression: empty deps for .cjs)'
                );
                t.match(
                    String(data.source || ''),
                    /helper-lib|require\(["']helper-lib["']\)/,
                    'CJS source is present in the manifest'
                );
            } finally {
                try {
                    fs.unlinkSync(mendelrcPath);
                } catch (e) {
                    /* ignore */
                }
                // Daemon leaves IPC handles open; same as CLI after build.
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
