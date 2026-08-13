const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Resolve monorepo plugins before chdir so config can use absolute plugin paths.
const outletManifest = path.resolve(__dirname, '../../mendel-outlet-manifest');

// Glob entries can only match files the daemon's watcher discovered, so this
// build hangs if a dot segment anywhere in the project path (e.g. a checkout
// under a hidden directory) makes the watcher ignore the whole tree.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-dot-'));
const appPath = path.join(tmpRoot, '.hidden-parent', 'app-project');
const appBuildPath = path.join(appPath, 'build');

function writeFixture() {
    fs.mkdirSync(path.join(appPath, 'app'), { recursive: true });
    fs.mkdirSync(path.join(appPath, 'variations', 'var_a'), {
        recursive: true,
    });
    fs.mkdirSync(appBuildPath, { recursive: true });
    fs.writeFileSync(
        path.join(appPath, 'app', 'index.js'),
        'var helper = require("./helper");\nmodule.exports = helper;\n'
    );
    fs.writeFileSync(
        path.join(appPath, 'app', 'helper.js'),
        'module.exports = "base-helper";\n'
    );
    fs.writeFileSync(
        path.join(appPath, 'variations', 'var_a', 'helper.js'),
        'module.exports = "var-a-helper";\n'
    );
    const yaml = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs:
    - ./variations
  variations:
    var_a:
      - var_a

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
      - '**/*.js'
`;
    fs.writeFileSync(path.join(appPath, '.mendelrc'), yaml);
}

tap.test('daemon discovers files under a dot-dir project path', function (t) {
    t.plan(4);
    writeFixture();

    const prevCwd = process.cwd();
    process.chdir(appPath);
    process.env.MENDELRC = '.mendelrc';
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
                return t.bailout('dot-dir sample build failed', error);
            }

            const manifestPath = path.join(appBuildPath, 'main.manifest.json');
            t.ok(fs.existsSync(manifestPath), 'writes main.manifest.json');

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const ids = Object.keys(manifest.indexes);
            t.ok(ids.includes('./'), 'glob entry found the base entry file');
            t.ok(ids.includes('./helper'), 'glob entry found the base helper');
            const helper = manifest.bundles[manifest.indexes['./helper']];
            t.equal(
                helper.data.length,
                2,
                'watcher discovered the variation of the helper too'
            );
        } finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
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
