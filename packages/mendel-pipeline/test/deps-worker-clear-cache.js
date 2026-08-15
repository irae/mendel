const tap = require('tap');
const path = require('path');
const fs = require('fs');
const { stageFixture } = require('./helpers');

// The worker's analytics reporter sends timings to its master over IPC; here
// that channel belongs to the test runner, so swallow them.
process.send = () => {};

const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/imports-watch-project'),
    'deps-worker-clear-cache',
    { copy: true }
);
const entry = path.join(appPath, 'app/index.js');

const worker = require('../src/deps/worker')();

function writeImports(target) {
    fs.writeFileSync(
        path.join(appPath, 'package.json'),
        JSON.stringify({
            name: 'imports-watch-project',
            imports: { '#dep': target },
        })
    );
}

function detect() {
    return worker.start(
        {
            filePath: entry,
            source: fs.readFileSync(entry, 'utf8'),
            projectRoot: appPath,
            baseConfig: { id: 'base', dir: './app' },
            variationConfig: { variations: [], allDirs: [] },
        },
        (type, payload) => {
            // The daemon answers "has" from its cache; nothing is built here,
            // so every file falls through to the filesystem check.
            if (type === 'has')
                setImmediate(() =>
                    worker.has({ filePath: payload.filePath, value: false })
                );
        }
    );
}

function depOf(result) {
    return result.deps['#dep'].browser;
}

tap.test('clearCache picks up an edited "imports" map', (t) => {
    const prevCwd = process.cwd();
    process.chdir(appPath);
    t.teardown(() => process.chdir(prevCwd));

    return detect()
        .then((result) => {
            t.equal(
                depOf(result),
                './app/first.js',
                'resolves the map on disk'
            );
            writeImports('./app/second.js');
            worker.clearCache();
            return detect();
        })
        .then((result) => {
            t.equal(
                depOf(result),
                './app/second.js',
                'the package scope was re-read after the clear'
            );
        });
});
