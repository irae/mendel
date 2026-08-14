/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var t = require('tap');
var path = require('path');
var fs = require('fs');

var config = require('../');
var origEnv = process.env.NODE_ENV;
var origMendelEnv = process.env.MENDEL_ENV;
delete process.env.NODE_ENV;
delete process.env.MENDEL_ENV;
var where;

fs.mkdirSync('/tmp/1/2/3/', { recursive: true });
process.chdir('/tmp/');

t.match(
    config('./1/2/3/').basedir,
    '1/2/3',
    'recurses and give up if no config found'
);

t.match(
    config().variationConfig.allVariationDirs,
    [],
    'builds-basic variation object'
);

process.chdir(path.resolve(__dirname, './config-samples/2/subfolder/'));

t.match(
    config(),
    {
        basedir: path.resolve(__dirname, './config-samples/2/'),
        outdir: path.resolve(__dirname, './config-samples/2/mendel'),
        variations: {
            json_A: null,
            json_B: ['folder_B'],
        },
    },
    'find package.json, and match some variations'
);

process.chdir(path.resolve(__dirname));

where = './config-samples/1/';
t.match(
    config(where),
    { basedir: path.resolve(where) },
    "find .mendelrc, basedir defaults to it's path"
);

t.match(
    config({
        basedir: path.resolve(where),
        config: false,
    }),
    {
        bundles: [],
    },
    'skip file config option for CLI use'
);

t.match(
    config({
        basedir: path.resolve(where),
        outdir: path.resolve(where, 'myoutdir'),
        bundlesoutdir: path.resolve(where, 'myoutdir/le-bundles'),
        serveroutdir: path.resolve(where, 'myoutdir/le-node'),
    }),
    {
        basedir: path.resolve(where),
        outdir: path.resolve(where, 'myoutdir'),
        bundlesoutdir: path.resolve(where, 'myoutdir/le-bundles'),
        serveroutdir: path.resolve(where, 'myoutdir/le-node'),
    },
    'leaves absolite paths untouched'
);

where = './config-samples/3/';
t.match(
    config(where),
    {
        basedir: path.resolve(__dirname),
        outdir: path.resolve(__dirname, 'config-samples/mendel'),
    },
    "ignores package.json that don't contain 'mendel' entry"
);

t.match(
    config({
        outdir: '../build',
        bundleName: 'testBundle',
    }),
    {
        basedir: path.resolve(__dirname),
        outdir: path.resolve(__dirname, '../build'),
        bundleName: 'testBundle',
    },
    'custom bundleName and outdir'
);

where = './config-samples';
t.match(
    config(where),
    {
        bundles: [{ id: 'vendor' }, { id: 'main' }],
    },
    'default environment'
);

t.match(
    config(where),
    {
        bundles: [
            { id: 'vendor' },
            { id: 'main', external: ['react', 'react-dom', './foo.js'] },
        ],
    },
    'flattens arrays if externals'
);

process.env.MENDEL_ENV = 'test';
t.match(
    config(where),
    {
        bundles: [
            { id: 'vendor' },
            { id: 'main', transform: ['testify'] },
            { id: 'test', entries: ['foo.js', 'bar.js'] },
        ],
    },
    'test environment'
);

t.match(
    config(where),
    {
        bundlesoutdir: path.resolve(
            __dirname,
            './config-samples/mendel-build/client-test'
        ),
    },
    'merge env config options'
);

process.chdir(path.resolve(__dirname, './config-samples/2/subfolder/'));
t.match(
    config(),
    {
        base: 'testbase',
    },
    'merge package.json env configs'
);

delete process.env.MENDEL_ENV;

process.chdir(path.resolve(__dirname));
process.env.NODE_ENV = 'staging';
t.match(
    config(where),
    {
        bundles: [
            { id: 'vendor' },
            { id: 'main' },
            { id: 'test', entries: ['bar.js'] },
        ],
    },
    'staging environment'
);

where = './config-samples/4/';

function fakeModules(modules) {
    var paths = modules.map(function (moduleName) {
        return path.join(
            __dirname,
            where,
            'node_modules',
            moduleName,
            'index.js'
        );
    });

    paths.forEach(function (modulePath) {
        fs.mkdirSync(path.dirname(modulePath), { recursive: true });
        fs.writeFileSync(modulePath, '');
    });
    var moduleNameToPath = {};
    paths.forEach(function (modulePath, index) {
        moduleNameToPath[modules[index]] = modulePath;
    });
    return moduleNameToPath;
}

var fakes = fakeModules([
    'mendel-babelify',
    'mendel-envify',
    'mendel-extract-bundles',
    'mendel-extract-node-modules',
    'autoprefixer',
]);

process.env.NODE_ENV = 'development';
t.match(
    config(where),
    {
        baseConfig: {
            id: 'default',
            dir: /.*src\/default$/,
        },
    },
    'dev environment baseConfig'
);
t.match(
    config(where),
    {
        types: [
            {
                name: 'node_modules',
                isBinary: false,
                isResource: false,
                parser: null,
            },
            {
                name: 'js',
                transforms: ['envify-dev'],
            },
        ],
    },
    'dev environment types'
);
t.match(
    config(where),
    {
        transforms: [
            {
                id: 'babelify-prod',
                plugin: fakes['mendel-babelify'],
                options: {
                    plugins: [
                        'react-intl-remove-description',
                        'transform-react-remove-prop-types',
                    ],
                },
            },
            {
                id: 'envify-dev',
                plugin: fakes['mendel-envify'],
                options: {
                    NODE_ENV: 'development',
                },
            },
            {
                id: 'envify-prod',
                plugin: fakes['mendel-envify'],
                options: {
                    NODE_ENV: 'production',
                },
            },
        ],
    },
    'dev environment transforms'
);
t.match(
    config(where),
    {
        outlets: [
            {
                id: 'manifest',
                plugin: /.+\/mendel-outlet-manifest.*/,
            },
            {
                id: 'css',
                plugin: /.+\/mendel-outlet-css.*/,
                options: {
                    plugin: [
                        [/.+\/autoprefixer.*/, { browsers: 'last 2 versions' }],
                    ],
                },
            },
        ],
    },
    'dev environment outlets'
);

process.env.NODE_ENV = 'production';
t.match(
    config(where),
    {
        baseConfig: {
            id: 'default',
            dir: /.*src\/default$/,
        },
        types: [
            {
                name: 'node_modules',
                isBinary: false,
                isResource: false,
                parser: null,
            },
            {
                name: 'js',
                isBinary: false,
                isResource: false,
                parser: null,
                transforms: ['envify-prod', 'babelify-prod'],
            },
        ],
    },
    'production environment'
);

process.env.NODE_ENV = origEnv;
process.env.MENDEL_ENV = origMendelEnv;
