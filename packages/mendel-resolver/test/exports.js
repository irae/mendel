const { test } = require('tap');
const path = require('path');
const Resolver = require('../');

const fixtureDir = path.resolve(__dirname, './fixtures/exports');
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

test('exports-only package with require/import conditions', (t) => {
    return createResolver()
        .resolve('modernpkg')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('modernpkg/dist/index.cjs'),
                browser: pkgPath('modernpkg/dist/index.cjs'),
                module: pkgPath('modernpkg/dist/index.mjs'),
            });
        });
});

test('exports string sugar', (t) => {
    return createResolver()
        .resolve('stringsugar')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('stringsugar/lib/main.js'),
                browser: pkgPath('stringsugar/lib/main.js'),
                module: pkgPath('stringsugar/lib/main.js'),
            });
        });
});

test('top-level conditions sugar with nested types/default', (t) => {
    return createResolver()
        .resolve('condsugar')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('condsugar/dist/retrier.cjs'),
                browser: pkgPath('condsugar/dist/retrier.cjs'),
                module: pkgPath('condsugar/dist/retrier.js'),
            });
        });
});

test('types condition listed first is skipped', (t) => {
    return createResolver()
        .resolve('typesfirst')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('typesfirst/index.js'),
                browser: pkgPath('typesfirst/index.js'),
                module: pkgPath('typesfirst/index.js'),
            });
        });
});

test('subpath map root entry', (t) => {
    return createResolver()
        .resolve('subpaths')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('subpaths/index.js'),
                browser: pkgPath('subpaths/index.js'),
                module: pkgPath('subpaths/index.js'),
            });
        });
});

test('deep import through subpath map', (t) => {
    return createResolver()
        .resolve('subpaths/feature')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('subpaths/lib/feature.js'),
                browser: pkgPath('subpaths/lib/feature.js'),
                module: pkgPath('subpaths/lib/feature.js'),
            });
        });
});

test('subpath with per-runtime conditions', (t) => {
    return createResolver()
        .resolve('subpaths/server')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('subpaths/lib/server.node.js'),
                browser: pkgPath('subpaths/lib/server.browser.js'),
                module: pkgPath('subpaths/lib/server.node.js'),
            });
        });
});

test('exported package.json subpath resolves', (t) => {
    return createResolver()
        .resolve('subpaths/package.json')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('subpaths/package.json'),
                browser: pkgPath('subpaths/package.json'),
                module: pkgPath('subpaths/package.json'),
            });
        });
});

test('null target blocks a subpath', (t) => {
    return t.rejects(createResolver().resolve('subpaths/blocked'));
});

test('unlisted subpath is encapsulated even when the file exists', (t) => {
    return t.rejects(createResolver().resolve('subpaths/hidden'));
});

test('wildcard subpath pattern', (t) => {
    return createResolver()
        .resolve('patterns/features/a')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('patterns/src/features/a.js'),
                browser: pkgPath('patterns/src/features/a.js'),
                module: pkgPath('patterns/src/features/a.js'),
            });
        });
});

test('subpath not covered by any pattern is encapsulated', (t) => {
    return t.rejects(createResolver().resolve('patterns/other'));
});

test('catch-all pattern preserves deep file imports', (t) => {
    return createResolver()
        .resolve('catchall/lib/util.js')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('catchall/lib/util.js'),
                browser: pkgPath('catchall/lib/util.js'),
                module: pkgPath('catchall/lib/util.js'),
            });
        });
});

test('catch-all package root entry uses "." conditions', (t) => {
    return createResolver()
        .resolve('catchall')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('catchall/index.js'),
                browser: pkgPath('catchall/index.js'),
                module: pkgPath('catchall/index.mjs'),
            });
        });
});

test('deeply nested conditions with unknown conditions skipped', (t) => {
    return createResolver()
        .resolve('nested')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('nested/dist/node/axios.cjs'),
                module: pkgPath('nested/index.js'),
                // legacy browser-field object overlay wins over exports
                browser: {
                    [pkgPath('nested/dist/node/axios.cjs')]: pkgPath(
                        'nested/dist/browser/axios.cjs'
                    ),
                    [pkgPath('nested/lib/adapters/http.js')]: pkgPath(
                        'nested/lib/helpers/null.js'
                    ),
                },
            });
        });
});

test('array targets try each entry in order', (t) => {
    return createResolver()
        .resolve('arraytarget/helpers/toArray')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('arraytarget/helpers/toArray.js'),
                browser: pkgPath('arraytarget/helpers/toArray.js'),
                module: pkgPath('arraytarget/helpers/esm/toArray.js'),
            });
        });
});

test('package without "." export blocks bare require', (t) => {
    return t.rejects(createResolver().resolve('arraytarget'));
});

test('legacy browser string field wins over exports browser condition', (t) => {
    return createResolver()
        .resolve('legacy-browser')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('legacy-browser/index.js'),
                browser: pkgPath('legacy-browser/browser.js'),
                module: pkgPath('legacy-browser/wrapper.mjs'),
            });
        });
});

test('legacy fields and exports agree on the canonical dual package', (t) => {
    return createResolver()
        .resolve('nanoid-like')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('nanoid-like/index.cjs'),
                module: pkgPath('nanoid-like/index.js'),
                browser: {
                    [pkgPath('nanoid-like/index.js')]: pkgPath(
                        'nanoid-like/index.browser.js'
                    ),
                    [pkgPath('nanoid-like/index.cjs')]: pkgPath(
                        'nanoid-like/index.browser.cjs'
                    ),
                },
            });
        });
});

test('condition object keys match in order, first match wins', (t) => {
    return createResolver()
        .resolve('ordered')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('ordered/first.js'),
                browser: pkgPath('ordered/first.js'),
                module: pkgPath('ordered/first.js'),
            });
        });
});

test('exports wins over a stale legacy main', (t) => {
    return createResolver()
        .resolve('stale-main')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('stale-main/dist/real.cjs'),
                browser: pkgPath('stale-main/dist/real.cjs'),
            });
        });
});

test('scoped package root through exports', (t) => {
    return createResolver()
        .resolve('@scope/pkg')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('@scope/pkg/lib/index.js'),
                browser: pkgPath('@scope/pkg/lib/index.js'),
                module: pkgPath('@scope/pkg/lib/index.js'),
            });
        });
});

test('scoped package subpath through exports', (t) => {
    return createResolver()
        .resolve('@scope/pkg/feature')
        .then((resolved) => {
            t.same(resolved, {
                main: pkgPath('@scope/pkg/lib/feature.js'),
                browser: pkgPath('@scope/pkg/lib/feature.js'),
                module: pkgPath('@scope/pkg/lib/feature.js'),
            });
        });
});

// Each of these subpaths resolves to a real file when the ".."/"node_modules"
// segment is honored, so the rejection only happens because it is rejected.
test('a .. segment cannot walk a pattern match out of the package', (t) => {
    return t.rejects(
        createResolver().resolve('patterns/features/../../../../index')
    );
});

test('a node_modules segment cannot reach a package nested dependency', (t) => {
    return t.rejects(
        createResolver().resolve('catchall/node_modules/inner/index')
    );
});

test('a pattern match that is a bare .. segment is rejected', (t) => {
    return t.rejects(createResolver().resolve('catchall/esc..'));
});
