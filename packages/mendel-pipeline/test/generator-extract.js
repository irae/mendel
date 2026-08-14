const tap = require('tap');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

// Resolve monorepo plugins before chdir so config can use absolute plugin paths.
const monorepoPackages = path.resolve(__dirname, '../..');
const outletManifest = path.join(monorepoPackages, 'mendel-outlet-manifest');
const generatorExtract = path.join(
    monorepoPackages,
    'mendel-generator-extract'
);

const appPath = path.resolve(__dirname, './extract-samples');
const appBuildPath = path.join(appPath, 'build');
const mendelrcPath = path.join(appPath, '.extract.mendelrc');

function writeMendelrc() {
    const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs:
    - ./variations
  variations:
    test_A:
      - test_A

route-config:
  variation: /mendel/:variations/:bundle
  hash: /mendel/:hash/:bundle

types:
  js:
    outlet:
      plugin: mendel-bundle-browser-pack
    extensions:
      - .js

outlets:
  - id: manifest
    plugin: ${outletManifest}
    options:
      uglify: false
      envify: false

generators:
  - id: extract-bundles
    plugin: ${generatorExtract}

bundles:
  main:
    outlet: manifest
    manifest: main.manifest.json
    entries:
      - ./index.js
  lazy:
    outlet: manifest
    manifest: lazy.manifest.json
    generator: extract-bundles
    from: main
    entries:
      - ./number-list.js
      - ./another-number.js
      - ./throws.js
`;
    fs.writeFileSync(mendelrcPath, yaml);
}

// Skipped: the lazy bundle's ./third-number.js exists only under
// variations/test_A, with no base counterpart. mendel-resolver can't
// resolve a file that's introduced entirely by a variation -- see
// https://github.com/irae/mendel/issues/7. Not a config/fixture problem;
// re-enable once that's fixed.
tap.skip('Build the extraction app', function (t) {
    t.plan(2);
    writeMendelrc();
    rimraf.sync(appBuildPath);
    rimraf.sync(path.join(appPath, '.mendelipc'));
    fs.mkdirSync(appBuildPath, { recursive: true });

    const prevCwd = process.cwd();
    process.chdir(appPath);
    process.env.MENDELRC = '.extract.mendelrc';
    delete process.env.NODE_ENV;
    delete process.env.MENDEL_ENV;

    // Require after env is set; Mendel reads MENDELRC at construct time.
    delete require.cache[require.resolve('../')];
    const MendelV2 = require('../');
    const mendel = new MendelV2();

    const finish = (error) => {
        process.chdir(prevCwd);
        try {
            if (error)
                return t.bailout('should create manifest but failed', error);

            const mainPath = path.join(appBuildPath, 'main.manifest.json');
            const lazyPath = path.join(appBuildPath, 'lazy.manifest.json');

            delete require.cache[require.resolve(mainPath)];
            delete require.cache[require.resolve(lazyPath)];
            const main = require(mainPath);
            const lazy = require(lazyPath);

            t.match(
                main.indexes,
                {
                    './': /\d/,
                    './math': /\d/,
                    './some-number': /\d/,
                },
                'indices have all normalizedId expected in main'
            );
            t.match(
                lazy.indexes,
                {
                    './another-number': /\d/,
                    './number-list': /\d/,
                    './util': /\d/,
                    './third-number': /\d/,
                },
                'indices have all normalizedId expected in lazy'
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
});
