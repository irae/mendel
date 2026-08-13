const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const monorepoPackages = path.resolve(__dirname, '../../..');
const outletManifest = path.join(monorepoPackages, 'mendel-outlet-manifest');
const parserPlaintext = path.join(monorepoPackages, 'mendel-parser-plaintext');
const mendelPipeline = path.resolve(__dirname, '../..');

exports.parserPlaintext = parserPlaintext;

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
    const mendelrcPath = path.join(appPath, '.mendelrc');
    const appBuildPath = exports.buildPathFor(appPath);

    fs.writeFileSync(mendelrcPath, yaml);
    rimraf.sync(appBuildPath);
    rimraf.sync(path.join(appPath, '.mendelipc'));
    fs.mkdirSync(appBuildPath, { recursive: true });

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
        callback(error);
    });
};
