// Resolver output used to be relativized twice: nested resolve() calls
// returned cwd-relative paths that the outer resolve() relativized again,
// resolving them against process.cwd() and producing garbage whenever it
// differed from the resolver's cwd option.
const { test } = require('tap');
const path = require('path');
const os = require('os');
const Resolver = require('../');

const fixtureDir = path.resolve(__dirname, './fixtures/node-modules');
const legacyFixtureDir = path.resolve(__dirname, './fixtures/legacy-fields');

function createResolver(cwd) {
    return new Resolver({
        cwd,
        basedir: cwd,
        runtimes: ['main', 'browser', 'module'],
    });
}

test('package resolution does not depend on process.cwd()', (t) => {
    process.chdir(os.tmpdir());
    return createResolver(fixtureDir)
        .resolve('fake-module')
        .then((fromTmp) => {
            process.chdir(fixtureDir);
            return createResolver(fixtureDir)
                .resolve('fake-module')
                .then((fromFixture) => {
                    t.same(fromTmp, fromFixture);
                    t.same(fromTmp, {
                        main: './node_modules/fake-module/index.js',
                        browser: './node_modules/fake-module/index.js',
                        module: './node_modules/fake-module/index.js',
                    });
                });
        });
});

test('legacy field resolution does not depend on process.cwd()', (t) => {
    process.chdir(os.tmpdir());
    return createResolver(legacyFixtureDir)
        .resolve('umd-ignored')
        .then((fromTmp) => {
            process.chdir(legacyFixtureDir);
            return createResolver(legacyFixtureDir)
                .resolve('umd-ignored')
                .then((fromFixture) => {
                    t.same(fromTmp, fromFixture);
                    t.same(fromTmp, {
                        main: './node_modules/umd-ignored/dist/lib.cjs.js',
                        browser: './node_modules/umd-ignored/dist/lib.cjs.js',
                        module: './node_modules/umd-ignored/dist/lib.esm.js',
                    });
                });
        });
});

test('browser object mapping does not depend on process.cwd()', (t) => {
    process.chdir(os.tmpdir());
    return createResolver(legacyFixtureDir)
        .resolve('browser-object')
        .then((fromTmp) => {
            process.chdir(legacyFixtureDir);
            return createResolver(legacyFixtureDir)
                .resolve('browser-object')
                .then((fromFixture) => {
                    t.same(fromTmp, fromFixture);
                    t.same(fromTmp.browser, {
                        './node_modules/browser-object/lib/node/index.js':
                            './node_modules/browser-object/lib/client.js',
                        './node_modules/emitter/index.js':
                            './node_modules/component-emitter/index.js',
                        './node_modules/browser-object/lib/node/http.js': false,
                    });
                });
        });
});
