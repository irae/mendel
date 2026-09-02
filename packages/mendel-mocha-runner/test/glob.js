const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

let mochaOptions;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'mocha') {
        return class {
            constructor(options) {
                mochaOptions = options;
                this.suite = { emit() {} };
            }

            run() {
                return { on() {} };
            }
        };
    }
    if (request === 'mendel-pipeline/client') {
        return class {
            run() {
                return {
                    on(event, callback) {
                        if (event === 'ready') callback();
                    },
                    registry: {
                        getEntriesByGlob() {
                            return [];
                        },
                    },
                };
            }
        };
    }
    if (request === 'mendel-exec') {
        return { exec() {}, execWithRegistry() {} };
    }
    if (request === 'mendel-exec/source-mapper') return () => {};
    return originalLoad.call(this, request, parent, isMain);
};
const MendelRunner = require('../');
Module._load = originalLoad;

test('expands prelude glob patterns', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-mocha-'));
    const options = { prelude: path.join(dir, '*.js') };
    fs.writeFileSync(path.join(dir, 'prelude.js'), '');

    MendelRunner([], options);

    assert.deepEqual(mochaOptions.prelude, [path.join(dir, 'prelude.js')]);
    fs.rmSync(dir, { recursive: true, force: true });
});
