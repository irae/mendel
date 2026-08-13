// Pins package.json field behaviors:
// - pkg.exports.umd / pkg.unpkg are ignored; browser falls back to main.
//   The umd/unpkg special case (commit a4faf37e) never worked — its
//   fallback path never entered the resolved deps map, so it dropped the
//   browser runtime instead of picking the umd build — and was retired.
// - browser-field object mapping incl. module rename and `false` stub,
//   motivated by superagent (commits 64521c6d and d899fae)
const { test } = require('tap');
const path = require('path');
const Resolver = require('../');

const fixtureDir = path.resolve(__dirname, './fixtures/legacy-fields');
// resolver output is relativized against cwd twice; results are only
// stable when process.cwd() matches the resolver cwd
process.chdir(fixtureDir);

function createResolver() {
    return new Resolver({
        cwd: fixtureDir,
        basedir: fixtureDir,
        runtimes: ['main', 'browser', 'module'],
    });
}

function pkgPath(rest) {
    return './node_modules/' + rest;
}

test('exports.umd is ignored; browser falls back to main', (t) => {
    return createResolver()
        .resolve('umd-pkg')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('umd-pkg/dist/lib.js'),
                module: pkgPath('umd-pkg/dist/lib.js'),
                browser: pkgPath('umd-pkg/dist/lib.js'),
            });
        });
});

test('exports.umd ignored when main differs from module', (t) => {
    return createResolver()
        .resolve('umd-ignored')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('umd-ignored/dist/lib.cjs.js'),
                module: pkgPath('umd-ignored/dist/lib.esm.js'),
                browser: pkgPath('umd-ignored/dist/lib.cjs.js'),
            });
        });
});

test('unpkg is ignored; browser falls back to main', (t) => {
    return createResolver()
        .resolve('unpkg-pkg')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('unpkg-pkg/dist/lib.js'),
                module: pkgPath('unpkg-pkg/dist/lib.js'),
                browser: pkgPath('unpkg-pkg/dist/lib.js'),
            });
        });
});

test('browser object maps files, renames modules, and stubs false', (t) => {
    return createResolver()
        .resolve('browser-object')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('browser-object/lib/node/index.js'),
                module: pkgPath('browser-object/lib/node/index.js'),
                browser: {
                    [pkgPath('browser-object/lib/node/index.js')]: pkgPath(
                        'browser-object/lib/client.js'
                    ),
                    [pkgPath('emitter/index.js')]: pkgPath(
                        'component-emitter/index.js'
                    ),
                    [pkgPath('browser-object/lib/node/http.js')]: false,
                },
            });
        });
});
