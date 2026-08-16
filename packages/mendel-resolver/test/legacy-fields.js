// Pins package.json field behaviors:
// - pkg.exports.umd is an honored browser condition: d3-style packages
//   expose only {umd, default} where default is raw ESM a CJS pack cannot
//   wrap. pkg.unpkg (outside exports) stays ignored — the old special
//   case for it (commit a4faf37e) never worked and was retired.
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

test('exports.umd wins the browser runtime; main and module keep legacy', (t) => {
    return createResolver()
        .resolve('umd-pkg')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('umd-pkg/dist/lib.js'),
                module: pkgPath('umd-pkg/dist/lib.js'),
                browser: pkgPath('umd-pkg/dist/lib.umd.js'),
            });
        });
});

test('exports.umd wins browser when main differs from module', (t) => {
    return createResolver()
        .resolve('umd-ignored')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('umd-ignored/dist/lib.cjs.js'),
                module: pkgPath('umd-ignored/dist/lib.esm.js'),
                browser: pkgPath('umd-ignored/dist/lib.umd.js'),
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

// One declared path is stale while others resolve; the stale path must
// cost only its own runtime, and never leave phantom undefined-valued
// keys behind (deps.get() returns false for it, and false[name] is
// undefined, not an error).
test('stale main still resolves the other declared runtimes', (t) => {
    return createResolver()
        .resolve('stale-main-partial')
        .then((resolved) => {
            t.same(resolved, {
                module: pkgPath('stale-main-partial/lib/real.js'),
            });
            t.same(Object.keys(resolved), ['module']);
        });
});

test('browser mapping to a missing file is dropped, not fatal', (t) => {
    return createResolver()
        .resolve('broken-browser-map')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('broken-browser-map/lib/real.js'),
                module: pkgPath('broken-browser-map/lib/real.js'),
                browser: {},
            });
            t.same(Object.keys(resolved.browser), []);
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
