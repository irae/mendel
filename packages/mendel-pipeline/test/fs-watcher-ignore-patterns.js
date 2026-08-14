const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FsWatcher = require('../src/fs-watcher');

function createTestWatcher(ignores) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-watcher-'));
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, '.hidden'), { recursive: true });
    fs.writeFileSync(
        path.join(tmpRoot, 'src', 'app.js'),
        'module.exports = {};\n'
    );
    fs.writeFileSync(path.join(tmpRoot, 'src', 'app.test.js'), '// test\n');
    fs.writeFileSync(path.join(tmpRoot, 'src', 'keep.test.js'), '// keep\n');
    fs.writeFileSync(path.join(tmpRoot, '.hidden', 'secret.js'), '// hidden\n');

    const discovered = new Set();
    const mockCache = {
        on: () => {},
        addEntry: (id) => discovered.add(id),
        removeEntry: () => {},
    };

    const watcher = new FsWatcher({ projectRoot: tmpRoot, ignores }, mockCache);
    watcher.watcher.add(tmpRoot);

    return { watcher, tmpRoot, discovered };
}

tap.test('positive glob pattern ignores matching files', async (t) => {
    const { watcher, tmpRoot, discovered } = createTestWatcher([
        '**/*.test.js',
    ]);

    await new Promise((resolve) => {
        watcher.watcher.once('ready', () => {
            t.ok(discovered.has('./src/app.js'), 'includes non-test files');
            t.notOk(
                discovered.has('./src/app.test.js'),
                'ignores .test.js files'
            );
            t.notOk(
                discovered.has('./src/keep.test.js'),
                'ignores .test.js files'
            );
            watcher.onExit();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
            resolve();
        });
    });
});

tap.test('negated pattern overrides positive pattern', async (t) => {
    const { watcher, tmpRoot, discovered } = createTestWatcher([
        '**/*.test.js',
        '!**/keep.test.js',
    ]);

    await new Promise((resolve) => {
        watcher.watcher.once('ready', () => {
            t.ok(discovered.has('./src/app.js'), 'includes non-test files');
            t.notOk(discovered.has('./src/app.test.js'), 'ignores *.test.js');
            t.ok(
                discovered.has('./src/keep.test.js'),
                'negation overrides: keep.test.js is not ignored'
            );
            watcher.onExit();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
            resolve();
        });
    });
});

tap.test('dot-file ignore still works with user patterns', async (t) => {
    const { watcher, tmpRoot, discovered } = createTestWatcher([
        '**/*.test.js',
    ]);

    await new Promise((resolve) => {
        watcher.watcher.once('ready', () => {
            t.notOk(
                discovered.has('./.hidden/secret.js'),
                'ignores dot directories'
            );
            t.ok(discovered.has('./src/app.js'), 'includes normal files');
            watcher.onExit();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
            resolve();
        });
    });
});

tap.test(
    'ignore pattern does not match project ancestor directories',
    async (t) => {
        const parent = fs.mkdtempSync(
            path.join(os.tmpdir(), 'fixtures-mendel-watcher-')
        );
        const tmpRoot = path.join(parent, 'project');
        fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
        fs.writeFileSync(
            path.join(tmpRoot, 'src', 'app.js'),
            'module.exports = {};\n'
        );

        const discovered = new Set();
        const mockCache = {
            on: () => {},
            addEntry: (id) => discovered.add(id),
            removeEntry: () => {},
        };

        const watcher = new FsWatcher(
            { projectRoot: tmpRoot, ignores: ['**/fixtures*/**'] },
            mockCache
        );
        watcher.watcher.add(tmpRoot);

        await new Promise((resolve) => {
            watcher.watcher.once('ready', () => {
                t.ok(
                    discovered.has('./src/app.js'),
                    'a pattern matching an ancestor directory name does not ' +
                        'ignore the whole project'
                );
                watcher.onExit();
                fs.rmSync(parent, { recursive: true, force: true });
                resolve();
            });
        });
    }
);

tap.test('handles non-array ignores parameter', async (t) => {
    const { watcher, tmpRoot, discovered } = createTestWatcher('**/*.test.js');

    await new Promise((resolve) => {
        watcher.watcher.once('ready', () => {
            t.notOk(
                discovered.has('./src/app.test.js'),
                'scalar string pattern works'
            );
            t.ok(discovered.has('./src/app.js'), 'includes regular files');
            watcher.onExit();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
            resolve();
        });
    });
});
