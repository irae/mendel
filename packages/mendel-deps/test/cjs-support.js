const test = require('tap').test;
const deps = require('../');
const { readFileSync } = require('fs');
const path = require('path');
const Resolver = require('../../mendel-resolver');

test('supports dual-package extensions', function (t) {
    t.ok(
        deps.isSupported('.cjs'),
        '.cjs is supported for CommonJS dual packages'
    );
    t.ok(deps.isSupported('.mjs'), '.mjs is supported for explicit ESM');
    t.ok(deps.isSupported('.js'), '.js remains supported');
    t.end();
});

test('parses require() inside .cjs dual-package entry', function (t) {
    const fixtureDir = path.join(__dirname, 'fixtures/js/cjs-dual');
    const file = path.join(fixtureDir, 'index.cjs');
    const resolver = new Resolver({
        basedir: fixtureDir,
        cwd: fixtureDir,
        runtimes: ['browser', 'main'],
    });

    return deps({
        file,
        source: readFileSync(file, 'utf8'),
        resolver,
    }).then((result) => {
        t.ok(result['./foo'], 'finds relative require from .cjs');
        t.match(result['./foo'].browser, /foo\.js$/);
        t.match(result['./foo'].main, /foo\.js$/);
    });
});

test('parses require() inside real react-use-measure .cjs', function (t) {
    const monorepoRoot = path.resolve(__dirname, '../../..');
    const candidates = [
        path.join(
            monorepoRoot,
            'node_modules/react-use-measure/dist/index.cjs'
        ),
        path.join(
            monorepoRoot,
            'examples/full-example/node_modules/react-use-measure/dist/index.cjs'
        ),
    ];
    const file = candidates.find((p) => {
        try {
            readFileSync(p);
            return true;
        } catch (e) {
            return false;
        }
    });
    if (!file) {
        t.skip('react-use-measure not installed in workspace');
        return t.end();
    }

    const resolver = new Resolver({
        basedir: path.dirname(file),
        cwd: monorepoRoot,
        runtimes: ['browser', 'main', 'module'],
        recordPackageJson: true,
    });

    return deps({
        file,
        source: readFileSync(file, 'utf8'),
        resolver,
    }).then((result) => {
        t.ok(
            result.react,
            'detects require("react") in react-use-measure CJS build'
        );
        t.match(
            result.react.browser,
            /react/,
            'browser runtime resolves react'
        );
        t.match(result.react.main, /react/, 'main runtime resolves react');
    });
});
