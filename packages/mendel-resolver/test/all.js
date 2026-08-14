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

['easy-variational', 'hard-variational'].forEach((dir) => {
    test('variational ' + dir, function (t) {
        const dirPath = path.resolve(basePath, dir);
        process.chdir(dirPath);
        const config = parseConfig();

        config.basedir = dirPath + '/variations/var1/footer';
        config.runtimes = ['main', 'browser', 'extra'];

        return new VariationalResolver(config)
            .resolve('./variations/var1/footer')
            .then((resolved) => {
                const expected = JSON.parse(
                    fs.readFileSync(path.resolve(dirPath, 'expect.json'))
                );
                t.same(resolved, expected);
                t.end();
            });
    });
});

test('variational variation-only-file', function (t) {
    const dir = 'variation-only-file';
    const dirPath = path.resolve(basePath, dir);
    process.chdir(dirPath);
    const config = parseConfig();

    config.basedir = dirPath + '/variations/var1';
    config.runtimes = ['main'];

    return new VariationalResolver(config)
        .resolve('./variation-only-module')
        .then((resolved) => {
            const expected = JSON.parse(
                fs.readFileSync(path.resolve(dirPath, 'expect.json'))
            );
            t.same(resolved, expected);
            t.end();
        });
});
