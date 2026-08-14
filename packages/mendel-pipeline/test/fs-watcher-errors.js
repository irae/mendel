const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FsWatcher = require('../src/fs-watcher');

function createWatcher() {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-watch-err-'));
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(tmpRoot, 'src', 'app.js'),
        'module.exports = {};\n'
    );

    const discovered = new Set();
    const watcher = new FsWatcher(
        { projectRoot: tmpRoot, ignores: [] },
        {
            on: () => {},
            addEntry: (id) => discovered.add(id),
            removeEntry: () => {},
        }
    );
    watcher.watcher.add(tmpRoot);

    return { watcher, tmpRoot, discovered };
}

function onReady(watcher) {
    return new Promise((resolve) => watcher.watcher.once('ready', resolve));
}

/**
 * Functional regression: the builder must survive a filesystem watch failure on
 * one path. Without a listener the watcher rethrows, which reaches the daemon's
 * uncaughtException handler and force-closes the whole builder — one file whose
 * permissions changed used to take the dev stack down.
 */
tap.test(
    'a watch error on one path does not take the builder down',
    async (t) => {
        const { watcher, tmpRoot, discovered } = createWatcher();
        await onReady(watcher);

        const eacces = Object.assign(
            new Error(
                `EACCES: permission denied, watch '${tmpRoot}/src/app.js'`
            ),
            { code: 'EACCES', path: path.join(tmpRoot, 'src', 'app.js') }
        );

        t.doesNotThrow(
            () => watcher.watcher.emit('error', eacces),
            'a permission failure on a watched file is not fatal'
        );

        const enospc = Object.assign(new Error('ENOSPC: watch limit reached'), {
            code: 'ENOSPC',
        });
        t.doesNotThrow(
            () => watcher.watcher.emit('error', enospc),
            'exhausting the watch limit is not fatal either'
        );

        t.ok(
            discovered.has('./src/app.js'),
            'the watcher keeps reporting the files it can read'
        );

        watcher.onExit();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
);

/**
 * Functional regression: an unreadable file must not stop the builder from
 * picking up changes to the rest of the project.
 */
tap.test('the watcher keeps working after a watch error', async (t) => {
    const { watcher, tmpRoot, discovered } = createWatcher();
    await onReady(watcher);

    watcher.watcher.emit(
        'error',
        Object.assign(new Error('EACCES: permission denied'), {
            code: 'EACCES',
        })
    );

    const added = path.join(tmpRoot, 'src', 'later.js');
    fs.writeFileSync(added, 'module.exports = 1;\n');

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && !discovered.has('./src/later.js')) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    t.ok(
        discovered.has('./src/later.js'),
        'a file created after the error is still discovered'
    );

    watcher.onExit();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});
