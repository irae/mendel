const { test } = require('tap');
const path = require('path');
const Resolver = require('../');
const VariationalResolver = require('../variational-resolver');
const parseConfig = require('../../mendel-config');

const fixtureDir = path.resolve(__dirname, './fixtures/imports');

function createResolver(basedir) {
    return new Resolver({
        cwd: fixtureDir,
        basedir: basedir || fixtureDir,
        runtimes: ['main', 'browser', 'module'],
    });
}

function pkgDir(name) {
    return path.join(fixtureDir, 'node_modules', name);
}

test('subpath pattern from the project scope', (t) => {
    return createResolver()
        .resolve('#app/util')
        .then((resolved) => {
            t.same(resolved, {
                main: './src/util.js',
                browser: './src/util.js',
                module: './src/util.js',
            });
        });
});

test('conditions from the project scope differ per runtime', (t) => {
    return createResolver()
        .resolve('#env')
        .then((resolved) => {
            t.same(resolved, {
                main: './src/env.node.js',
                browser: './src/env.browser.js',
                module: './src/env.node.js',
            });
        });
});

test('imports of the package owning the requesting file', (t) => {
    const resolver = createResolver(path.join(pkgDir('chalk-like'), 'source'));
    return Promise.all([
        resolver.resolve('#ansi-styles'),
        resolver.resolve('#supports-color'),
    ]).then(([styles, color]) => {
        const stylesPath =
            './node_modules/chalk-like/source/vendor/ansi-styles/index.js';
        t.same(styles, {
            main: stylesPath,
            browser: stylesPath,
            module: stylesPath,
        });
        t.same(color, {
            main: './node_modules/chalk-like/source/vendor/supports-color/index.js',
            browser:
                './node_modules/chalk-like/source/vendor/supports-color/browser.js',
            module: './node_modules/chalk-like/source/vendor/supports-color/browser.js',
        });
    });
});

test('pattern with an unmatched condition listed first', (t) => {
    return createResolver(path.join(pkgDir('enums-like'), 'dist'))
        .resolve('#enums/kind')
        .then((resolved) => {
            const expected = './node_modules/enums-like/dist/enums/kind.js';
            t.same(resolved, {
                main: expected,
                browser: expected,
                module: expected,
            });
        });
});

test('bare package targets re-enter node_modules resolution', (t) => {
    const resolver = createResolver(path.join(pkgDir('bare-target'), 'lib'));
    return Promise.all([
        resolver.resolve('#dep'),
        resolver.resolve('#dep/extra'),
    ]).then(([dep, extra]) => {
        t.equal(dep.main, './node_modules/dep-pkg/lib/index.js');
        t.equal(extra.main, './node_modules/dep-pkg/lib/extra.js');
    });
});

test('imports wins over the browser overlay for "#" literals', (t) => {
    return createResolver(path.join(pkgDir('both-forms'), 'lib'))
        .resolve('#crypto')
        .then((resolved) => {
            t.same(resolved, {
                main: './node_modules/both-forms/lib/crypto.node.js',
                browser:
                    './node_modules/both-forms/lib/crypto.imports-browser.js',
                module: './node_modules/both-forms/lib/crypto.node.js',
            });
        });
});

test('unmatched "#" specifier is a hard failure', (t) => {
    const resolver = createResolver();
    return Promise.all([
        t.rejects(resolver.resolve('#nope'), 'no matching key'),
        t.rejects(resolver.resolve('#blocked'), 'null target blocks'),
        t.rejects(resolver.resolve('#src/util.js'), 'never falls back to file'),
    ]);
});

test('targets that are not package specifiers are rejected', (t) => {
    const resolver = createResolver();
    return Promise.all([
        t.rejects(
            resolver.resolve('#recursive'),
            'self-referencing "#" target'
        ),
        t.rejects(
            resolver.resolve('#mutual'),
            'mutually recursive "#" targets'
        ),
        t.rejects(
            resolver.resolve('#outside'),
            'relative target escaping the package'
        ),
    ]);
});

test('an invalid target does not consume the rest of its array', (t) => {
    return createResolver()
        .resolve('#fallback')
        .then((resolved) => {
            t.equal(resolved.main, './src/util.js');
        });
});

test('package scope stops at the package owning the file', (t) => {
    // "#app/*" belongs to the fixture root, not to chalk-like
    return t.rejects(
        createResolver(path.join(pkgDir('chalk-like'), 'source')).resolve(
            '#app/util'
        )
    );
});

test('variation file resolves against the project root scope', (t) => {
    const dirPath = path.resolve(__dirname, './fixtures/imports-variational');
    process.chdir(dirPath);
    const config = parseConfig();

    config.basedir = path.join(dirPath, 'variations/var1');
    config.runtimes = ['main'];

    // "imports" targets are package-relative, so they are not remapped
    // through the variation chain
    return new VariationalResolver(config)
        .resolve('#shared')
        .then((resolved) => {
            t.same(resolved, { main: './base/shared.js' });
        });
});
