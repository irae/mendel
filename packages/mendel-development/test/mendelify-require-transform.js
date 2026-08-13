/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var t = require('tap');
var mendelifyRequireTransform = require('../mendelify-require-transform');

var idMap = {
    foo: 'foo/variation1',
    bar: 'bar/variation2',
};
function mapTransformer(id) {
    return idMap[id] || id;
}
function identityTransformer(id) {
    return id;
}

t.test('rewrites require literals through the transformer', function (t) {
    var src = [
        "var foo = require('foo');",
        "var bar = require('bar');",
        "var baz = require('baz');",
    ].join('\n');

    var out = mendelifyRequireTransform('index.js', src, mapTransformer);

    t.match(out, "require('foo/variation1')", 'rewrites foo');
    t.notMatch(out, "require('foo')", 'original foo id gone');
    t.match(out, "require('bar/variation2')", 'rewrites bar');
    t.notMatch(out, "require('bar')", 'original bar id gone');
    t.match(out, "require('baz')", 'unmapped id left as-is');
    t.end();
});

t.test('leaves requires the transformer does not change', function (t) {
    var src = [
        "var foo = require('foo');",
        "var bar = require('some/dir/bar');",
    ].join('\n');

    var out = mendelifyRequireTransform('index.js', src, identityTransformer);

    t.equal(out, src, 'source is byte-identical when transformer is a no-op');
    t.end();
});

t.test(
    'ignores non-require call expressions and computed requires',
    function (t) {
        var src = [
            'var id = "foo";',
            'var foo = require(id);',
            "notRequire('foo');",
        ].join('\n');

        var out = mendelifyRequireTransform('index.js', src, mapTransformer);

        t.equal(out, src, 'computed and non-require calls are left untouched');
        t.end();
    }
);

t.test('passes through files with unsupported extensions', function (t) {
    var notValidJs = 'this is { not : valid javascript ]]] ---';

    var out = mendelifyRequireTransform(
        'styles.less',
        notValidJs,
        mapTransformer
    );

    t.equal(
        out,
        notValidJs,
        'unsupported extension returns source unchanged without parsing'
    );

    out = mendelifyRequireTransform('data.json', notValidJs, mapTransformer);

    t.equal(
        out,
        notValidJs,
        'json extension returns source unchanged without parsing'
    );
    t.end();
});

t.test('parses modern syntax the pipeline accepts', function (t) {
    var src = [
        "var foo = require('foo');",
        'var { a, b } = require("bar");',
        'var greet = (name) => `hello ${name}`;',
    ].join('\n');

    var out = mendelifyRequireTransform('index.js', src, mapTransformer);

    t.match(out, "require('foo/variation1')", 'rewrites foo');
    t.match(out, "require('bar/variation2')", 'rewrites bar');
    t.match(out, 'var greet = (name) => `hello ${name}`;', 'syntax preserved');
    t.end();
});
