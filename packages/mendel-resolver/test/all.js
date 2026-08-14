const { test } = require('tap');
const Resolver = require('../');
const VariationalResolver = require('../variational-resolver');
const fs = require('fs');
const path = require('path');
const basePath = path.resolve(__dirname, './fixtures');
const parseConfig = require('../../mendel-config');

['basic', 'package-json'].forEach((dir) => {
    const dirPath = path.resolve(basePath, dir);
    process.chdir(dirPath);

    test('resolve ' + dir, function (t) {
        const config = {};

        Object.assign(config, parseConfig());

        return new Resolver(config).resolve('.').then((resolved) => {
            const expected = JSON.parse(
                fs.readFileSync(path.resolve(dirPath, 'expect.json'))
            );
            t.same(resolved, expected);
            t.end();
        });
    });
});

test('resolve node-modules', function (t) {
    const dir = 'node-modules';
    const dirPath = path.resolve(basePath, dir);

    process.chdir(dirPath);
    const config = parseConfig();

    return new Resolver(config).resolve('fake-module').then((resolved) => {
        const expected = JSON.parse(
            fs.readFileSync(path.resolve(dirPath, 'expect.json'))
        );
        t.same(resolved, expected);
        t.end();
    });
});

test('resolve dual-package main=.cjs module=.js', function (t) {
    const dir = 'dual-cjs';
    const dirPath = path.resolve(basePath, dir);

    process.chdir(dirPath);
    const config = parseConfig();
    config.runtimes = ['main', 'browser', 'module'];

    return new Resolver(config).resolve('fake-dual').then((resolved) => {
        const expected = JSON.parse(
            fs.readFileSync(path.resolve(dirPath, 'expect.json'))
        );
        t.same(
            resolved,
            expected,
            'browser/main use CJS .cjs; module runtime keeps ESM .js'
        );
        t.end();
    });
});

// One project, three shapes a real variation setup mixes: a variation that
// ships its own package.json for a directory module, one that overrides a
// single file and falls back to the base package.json, and a module that only
// exists in the variation.
[
    {
        name: 'variation overrides a directory module wholesale',
        expect: 'footer',
        basedir: '/variations/var1/footer',
        request: './variations/var1/footer',
        runtimes: ['main', 'browser', 'extra'],
    },
    {
        name: 'variation overrides one file, base package.json still resolves',
        expect: 'sidebar',
        basedir: '/variations/var1/sidebar',
        request: './variations/var1/sidebar',
        runtimes: ['main', 'browser', 'extra'],
    },
    {
        name: 'module exists only in the variation',
        expect: 'variation-only',
        basedir: '/variations/var1',
        request: './variation-only-module',
        runtimes: ['main'],
    },
].forEach((testCase) => {
    test('variational: ' + testCase.name, function (t) {
        const dirPath = path.resolve(basePath, 'variational');
        process.chdir(dirPath);
        const config = parseConfig();

        config.basedir = dirPath + testCase.basedir;
        config.runtimes = testCase.runtimes;

        return new VariationalResolver(config)
            .resolve(testCase.request)
            .then((resolved) => {
                const expected = JSON.parse(
                    fs.readFileSync(
                        path.resolve(
                            dirPath,
                            'expect',
                            testCase.expect + '.json'
                        )
                    )
                );
                t.same(resolved, expected);
                t.end();
            });
    });
});
