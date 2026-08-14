const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const monorepoPackages = path.resolve(__dirname, '../../..');
const outletManifest = path.join(monorepoPackages, 'mendel-outlet-manifest');
const parserPlaintext = path.join(monorepoPackages, 'mendel-parser-plaintext');
const mendelPipeline = path.resolve(__dirname, '../..');

exports.parserPlaintext = parserPlaintext;

/**
 * Stage a read-only fixture into a disposable, gitignored run directory.
 *
 * The fixture is the single source of truth and is never written to; the run
 * directory holds everything a build generates (.mendelrc, .mendelipc, build/)
 * as real files next to links back to the fixture's sources.
 *
 * Each top-level child of the fixture is linked individually rather than the
 * fixture root, because node and mendel find node_modules by walking up from
 * the requiring file to the project root: linking only ./app would make that
 * walk land in the run directory, which has no node_modules of its own.
 *
 * A fixture's dependencies live in `stubs/` and are staged as `node_modules/`,
 * because a directory actually named node_modules cannot be committed.
 *
 * Pass `copy: true` for tests that mutate their sources (watch-mode recovery,
 * error handling) so the mutation lands in the run directory instead of the
 * repository.
 */
exports.stageFixture = function stageFixture(
    fixtureDir,
    runName,
    { copy = false, runRoot } = {}
) {
    if (!fs.existsSync(fixtureDir)) {
        throw new Error(`stageFixture: no fixture at ${fixtureDir}`);
    }

    const runDir = path.join(
        runRoot || path.resolve(__dirname, '..'),
        '.mendel-runs',
        runName
    );
    rimraf.sync(runDir);
    fs.mkdirSync(runDir, { recursive: true });

    const place = (target, linkPath) => {
        if (copy) return fs.cpSync(target, linkPath, { recursive: true });
        try {
            fs.symlinkSync(
                path.relative(path.dirname(linkPath), target),
                linkPath
            );
        } catch (e) {
            // Windows refuses symlinks without privileges; a copy is
            // equivalent for a read-only fixture.
            if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
            fs.cpSync(target, linkPath, { recursive: true });
        }
    };

    fs.readdirSync(fixtureDir)
        .filter((entry) => entry !== 'README.md' && entry !== 'expect')
        .forEach((entry) => {
            const target = path.join(fixtureDir, entry);
            if (entry === 'stubs') {
                const nodeModules = path.join(runDir, 'node_modules');
                fs.mkdirSync(nodeModules, { recursive: true });
                fs.readdirSync(target).forEach((pkg) =>
                    place(path.join(target, pkg), path.join(nodeModules, pkg))
                );
                return;
            }
            place(target, path.join(runDir, entry));
        });

    fs.mkdirSync(path.join(runDir, 'build'), { recursive: true });
    return runDir;
};

exports.buildPathFor = function buildPathFor(appPath) {
    return path.join(appPath, 'build');
};

exports.baseYaml = function baseYaml({
    types = '',
    transforms = '',
    entry,
    extraTop = '',
}) {
    return `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}
${extraTop}
transforms:${transforms ? '\n' + transforms : ' {}'}

types:
  js:
    extensions:
      - .js
${types}

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
      - ./${entry}
`;
};

exports.runBuild = function runBuild(appPath, yaml, callback) {
    fs.writeFileSync(path.join(appPath, '.mendelrc'), yaml);

    const prevCwd = process.cwd();
    process.chdir(appPath);
    delete process.env.MENDELRC;
    delete process.env.NODE_ENV;
    delete process.env.MENDEL_ENV;

    delete require.cache[require.resolve(mendelPipeline)];
    const MendelV2 = require(mendelPipeline);
    const mendel = new MendelV2();

    mendel.run((error) => {
        process.chdir(prevCwd);
        if (typeof mendel.onForceExit === 'function') {
            try {
                mendel.onForceExit();
            } catch (e) {
                /* ignore */
            }
        }
        callback(error);
    });
};
