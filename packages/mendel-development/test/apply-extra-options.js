const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const applyExtraOptions = require('../apply-extra-options');

test('resolves extra browserify options asynchronously', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-extra-'));
    const ignored = path.join(dir, 'ignored.js');
    const excluded = path.join(dir, 'excluded.js');
    fs.writeFileSync(ignored, '');
    fs.writeFileSync(excluded, '');

    const calls = { ignore: [], exclude: [], external: [], events: [] };
    let ready;
    const readyPromise = new Promise((resolve) => {
        ready = resolve;
    });
    const browserify = {
        _pending: 0,
        ignore(file) {
            calls.ignore.push(file);
        },
        exclude(file) {
            calls.exclude.push(file);
        },
        external(file) {
            calls.external.push(file);
        },
        emit(event) {
            calls.events.push(event);
            if (event === '_ready') ready();
        },
    };

    applyExtraOptions(browserify, {
        ignore: [ignored],
        exclude: [excluded],
        external: [path.join(dir, '*.js')],
    });
    await readyPromise;

    assert.deepEqual(calls.ignore, [ignored]);
    assert.deepEqual(calls.exclude, [excluded, excluded]);
    assert.deepEqual(calls.external.slice(1).sort(), [excluded, ignored]);
    assert.deepEqual(calls.events, ['_ready']);
    fs.rmSync(dir, { recursive: true, force: true });
});
