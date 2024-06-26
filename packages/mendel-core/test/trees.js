/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var tap = require('tap');
var test = tap.test;
var path = require('path');
var mkdirp = require('mkdirp');
var exec = require('child_process').exec;

var MendelTrees = require('../trees');

var appPath = path.resolve(__dirname, 'app-samples/1/');
var appBuild = path.join(appPath, 'build');
mkdirp.sync(appBuild);

test('MendelTrees initialization', function (t) {
    t.plan(3);

    t.doesNotThrow(MendelTrees, "won't throw at init without params");
    t.equal(MendelTrees().constructor, MendelTrees, 'returns instance');
    t.match(
        MendelTrees().variations,
        [
            {
                id: 'base',
                chain: [],
            },
        ],
        'fallback minimal configuration'
    );

    process.chdir(__dirname);
});

test('MendelTrees private methods', function (t) {
    t.plan(10);
    process.chdir(__dirname);

    var trees = MendelTrees();
    trees.config.basetree = 'base-chain';
    trees.variations = [
        {
            id: 'a',
            chain: ['a-chain', 'base-chain'],
        },
        {
            id: 'b',
            chain: ['b-chain', 'base-chain'],
        },
        {
            id: 'c',
            chain: ['c-chain', 'b-chain', 'base-chain'],
        },
        {
            id: 'base',
            chain: ['base-chain'],
        },
    ];

    t.equal(
        trees.variationsAndChains([]).lookupChains.length,
        1,
        'returns base if empty input'
    );
    t.equal(
        trees.variationsAndChains(['a']).lookupChains.length,
        2,
        'returns variation and base'
    );
    t.match(
        trees.variationsAndChains(['c']).lookupChains[0],
        ['c-chain', 'b-chain'],
        "valid chains don't contain base"
    );
    t.equal(
        trees.variationsAndChains(['a-chain']).lookupChains.length,
        1,
        'find variations, not chains'
    );
    t.equal(
        trees.variationsAndChains(['a', 'b']).lookupChains.length,
        3,
        'returns multiple variations'
    );
    t.match(
        JSON.stringify(trees.variationsAndChains(['a', 'b']).lookupChains),
        JSON.stringify(trees.variationsAndChains(['b', 'a']).lookupChains),
        'order is based on configuration, not input'
    );
    t.match(
        JSON.stringify(trees.variationsAndChains(['c', 'b']).lookupChains),
        JSON.stringify([
            ['b-chain', 'base-chain'],
            ['c-chain', 'b-chain', 'base-chain'],
            [''],
        ]),
        'correct full output, with only chains'
    );

    trees.bundles = {
        foo: {
            indexes: {
                'entry.js': 0,
                'second.js': 1,
            },
            bundles: [
                {
                    entry: true,
                    id: 'entry.js',
                    deps: {
                        './relative_dependency.js': 'second.js',
                        'excluded-dependency': false,
                    },
                },
                {
                    id: 'second.js',
                    deps: {},
                },
            ],
        },
    };
    var walkedModules = [];
    trees._walkTree('foo', {
        find: function (module) {
            walkedModules.push(module);
            return module;
        },
    });
    t.match(trees.bundles.foo.bundles[0], walkedModules[0]);
    t.match(trees.bundles.foo.bundles[1], walkedModules[1]);

    trees.bundles = {
        circular: {
            indexes: {
                'a.js': 0,
                'b.js': 1,
            },
            bundles: [
                {
                    entry: true,
                    id: 'a.js',
                    deps: {
                        './b.js': 'b.js',
                    },
                },
                {
                    id: 'b.js',
                    deps: {
                        './a.js': 'a.js',
                    },
                },
            ],
        },
    };
    var circularModules = [];
    trees._walkTree('circular', {
        find: function (module) {
            if (circularModules.indexOf(module) === -1) {
                circularModules.push(module);
            }
            return module;
        },
    });
    t.equal(circularModules.length, 2, 'works with circular deps');
});

tap.skip('MendelTrees valid manifest runtime', function (t) {
    t.plan(10);

    process.chdir(appPath);
    mkdirp.sync(appBuild);
    exec('./run.sh', { cwd: appPath }, function (error) {
        if (error) {
            console.log(error);
            return t.bailout('should create manifest but failed');
        }

        var trees = MendelTrees();
        var variationCount = trees.variations.length;

        t.match(Object.keys(trees.bundles), ['app'], 'loads manifest');
        t.equal(variationCount, 4, 'loads manifest');
        t.equal(
            trees.variations[variationCount - 1].id,
            'app',
            'includes base'
        );

        var result_1 = trees.findTreeForVariations(
            'app',
            trees.variationsAndChains(['test_A']).lookupChains
        );
        var result_2 = trees.findTreeForVariations(
            'app',
            trees.variationsAndChains(['test_A', 'test_B']).lookupChains
        );

        t.match(
            result_1,
            { deps: [] },
            'Finds one variation with string input'
        );
        t.match(
            result_2,
            { deps: [] },
            'Finds two variations with array input'
        );

        var hash = result_1.hash;

        var decoded = trees.findTreeForHash('app', hash);

        t.match(result_1, decoded, 'retrieves same tree from hahs');

        var map_1 = trees.findServerVariationMap(
            ['app'],
            trees.variationsAndChains(['test_A']).lookupChains
        );
        var map_2 = trees.findServerVariationMap(
            ['app'],
            trees.variationsAndChains(['test_A', 'test_B']).lookupChains
        );
        var map_3 = trees.findServerVariationMap(
            ['foo'],
            trees.variationsAndChains(['test_A']).lookupChains
        );
        var map_4 = trees.findServerVariationMap(
            [],
            trees.variationsAndChains(['test_A']).lookupChains
        );

        t.match(
            map_1,
            {
                'index.js': 'app',
                'math.js': 'test_A',
                'some-number.js': 'app',
                'another-number.js': 'app',
            },
            'map_1 variationMap sanity check'
        );
        t.match(
            map_2,
            {
                'index.js': 'app',
                'math.js': 'test_A',
                'some-number.js': 'test_B',
                'another-number.js': 'app',
            },
            'map_2 variationMap sanity check'
        );
        t.match(map_3, {}, 'map_3 variationMap sanity check');
        t.match(map_4, {}, 'map_4 variationMap sanity check');
    });
});
