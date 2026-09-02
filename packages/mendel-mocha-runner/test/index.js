/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

const path = require('path');
const test = require('tap').test;

const packageRoot = path.join(__dirname, '..');
const executed = [];

function stubModule(name, exports) {
    const resolved = require.resolve(name, { paths: [packageRoot] });
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports,
    };
}

let readyCallback;

class Client {
    constructor() {
        this.registry = {
            getEntriesByGlob() {
                return [
                    {
                        id: 'sample.js',
                        variation: 'base',
                        normalizedId: 'sample',
                        deps: {},
                    },
                ];
            },
            getEntry() {
                return null;
            },
            getExecutableEntries() {
                return null;
            },
        };
        this.config = {
            variationConfig: { variations: [{ chain: ['base'] }] },
        };
    }
    run() {
        return this;
    }
    on(event, callback) {
        if (event === 'ready') readyCallback = callback;
    }
}

stubModule('mendel-pipeline/client', Client);
stubModule('mendel-exec', {
    exec(id) {
        executed.push(id);
    },
    execWithRegistry() {
        return {};
    },
});
stubModule('mendel-exec/source-mapper', () => (stack) => stack);
stubModule(
    'mocha',
    class Mocha {
        constructor() {
            this.suite = { emit() {} };
        }
        run() {
            return { on() {} };
        }
    }
);

const MendelRunner = require('../index.js');

test('expands the prelude glob into files', function (t) {
    executed.length = 0;

    MendelRunner([path.join(__dirname, 'prelude-sample', 'a.js')], {
        prelude: path.join(__dirname, 'prelude-sample', '*.js'),
    });
    readyCallback();

    t.equal(executed.length, 1);
    t.match(executed[0], /prelude-sample\/a\.js$/);
    t.end();
});
