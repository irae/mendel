const test = require('tap').test;
const path = require('path');
const LessTransformer = require('../');

const fixture = path.join(__dirname, 'css-samples/app/index.less');

test('LessTransformer compiles less source to css', function (t) {
    const source = `
        @padding: 4px;
        .box {
            padding: @padding;
            .inner {
                background: blue;
            }
        }
    `;

    return LessTransformer({ source, filename: fixture }).then((result) => {
        t.type(result.source, 'string');
        t.match(result.source, /padding:\s*4px/);
        t.match(result.source, /background:\s*blue/);

        t.ok(
            result.map === null ||
                typeof result.map === 'string' ||
                typeof result.map === 'object',
            'map is a string/object source map or null, never undefined'
        );
        t.not(typeof result.map, 'undefined');
    });
});

test('LessTransformer strips the trailing sourceMappingURL comment', function (t) {
    const source = `
        .box {
            color: red;
        }
    `;

    return LessTransformer({ source, filename: fixture }).then((result) => {
        t.notMatch(result.source, /sourceMappingURL/);
    });
});

test('LessTransformer reports less syntax errors', function (t) {
    const source = `
        .box {
            color: @undefined-variable;
    `;

    return LessTransformer({ source, filename: fixture }).then(
        () => {
            t.fail('expected LessTransformer to reject malformed less');
        },
        (error) => {
            t.ok(error, 'rejects with an error');
            t.type(error.message, 'string');
            t.ok(error.message.length > 0, 'error identifies the problem');
        }
    );
});

test('LessTransformer declares the mendel transform contract', function (t) {
    t.equal(LessTransformer.parser, true);
    t.ok(LessTransformer.extensions.includes('.less'));
    t.equal(LessTransformer.compatible, '.css');
    t.end();
});
