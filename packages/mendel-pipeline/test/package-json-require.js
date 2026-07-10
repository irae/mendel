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
const parserJson = path.join(monorepoPackages, 'mendel-parser-json');

const appPath = path.resolve(__dirname, './package-json-require-samples');
const appBuildPath = path.join(appPath, 'build');
const mendelrcPath = path.join(appPath, '.pkgjson.mendelrc');
const stubPkg = path.join(appPath, 'stubs', 'fake-pkg-json');
const nmPkg = path.join(appPath, 'node_modules', 'fake-pkg-json');

// node_modules/ is gitignored; materialize the stub so Node/Mendel can resolve it.
function materializeNodeModule() {
    rimraf.sync(path.join(appPath, 'node_modules'));
    fs.mkdirSync(path.dirname(nmPkg), { recursive: true });
    fs.cpSync(stubPkg, nmPkg, { recursive: true });
}

function writeMendelrc() {
    // Same shape consumers use for karma-mendel + elliptic-style package.json requires:
    // json type with parser-to-type and include-node_modules.
    const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

transforms:
  json-parse:
    plugin: ${parserJson}

types:
  json:
    extensions:
      - .json
    parser: json-parse
    parser-to-type: js
    include-node_modules: true
  js:
    extensions:
      - .js
    include-node_modules: true

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

/**
 * Functional regression: node_modules packages that require('../package.json')
 * must land in the outlet graph with parsed JSON source.
 *
 * Real-world trigger: elliptic (and crypto-browserify chain) under karma-mendel.
 * Stub here avoids pulling elliptic; failure mode is the same dual-dep path
 * (JS node + package.json node, both required in browser runtime map).
 */
tap.test(
    'production-style build keeps package.json dual-dep of node_modules packages',
    function (t) {
        t.plan(8);
        materializeNodeModule();
        writeMendelrc();
        rimraf.sync(appBuildPath);
        rimraf.sync(path.join(appPath, '.mendelipc'));
        fs.mkdirSync(appBuildPath, { recursive: true });

        const prevCwd = process.cwd();
        process.chdir(appPath);
        process.env.MENDELRC = '.pkgjson.mendelrc';
        delete process.env.NODE_ENV;
        delete process.env.MENDEL_ENV;

        delete require.cache[require.resolve('../')];
        const MendelV2 = require('../');
        const mendel = new MendelV2();

        const finish = (error) => {
            process.chdir(prevCwd);
            try {
                if (error) {
                    return t.bailout(
                        'package-json-require sample build failed',
                        error
                    );
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

                const libKey = Object.keys(vendor.indexes).find((k) =>
                    /fake-pkg-json[/\\]lib[/\\]index\.js$/.test(k)
                );
                t.ok(
                    libKey,
                    'vendor indexes the package JS entry that requires package.json'
                );

                const libEntry = vendor.bundles[vendor.indexes[libKey]];
                const libData = libEntry.data[0];
                t.ok(
                    libData.deps &&
                        (libData.deps['../package.json'] ||
                            libData.deps['../package.json'] === false),
                    'JS entry records require("../package.json") in deps'
                );
                t.not(
                    libData.deps['../package.json'],
                    false,
                    'package.json dep is not stripped for browser (not false)'
                );

                const pkgJsonKey = Object.keys(vendor.indexes).find((k) =>
                    /fake-pkg-json[/\\]package\.json$/.test(k)
                );
                t.ok(
                    pkgJsonKey,
                    'vendor indexes package.json required by the JS entry (dual-dep; regression: runtime=package dropped from walk)'
                );

                if (pkgJsonKey) {
                    const pkgEntry = vendor.bundles[vendor.indexes[pkgJsonKey]];
                    const pkgData = pkgEntry.data[0];
                    t.match(
                        String(pkgData.source || ''),
                        /module\.exports\s*=/,
                        'package.json is parsed to a JS module.exports body'
                    );
                    t.match(
                        String(pkgData.source || ''),
                        /9\.9\.9/,
                        'parsed package.json source includes package version'
                    );
                } else {
                    // Keep plan count stable when dual-dep is missing.
                    t.fail(
                        'package.json dual-dep missing from vendor; cannot assert parser output'
                    );
                    t.fail(
                        'package.json dual-dep missing from vendor; cannot assert version in source'
                    );
                }
            } finally {
                try {
                    fs.unlinkSync(mendelrcPath);
                } catch (e) {
                    /* ignore */
                }
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
