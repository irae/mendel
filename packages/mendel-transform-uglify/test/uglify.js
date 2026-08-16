const { test } = require('tap');
const transform = require('../');

test('minifies source', (t) => {
    const { source } = transform(
        {
            source: 'function add (a, b) {\n    return a + b;\n}\nmodule.exports = add;',
            filename: 'add.js',
            map: null,
        },
        {}
    );
    t.type(source, 'string');
    t.ok(source.length > 0);
    t.notMatch(source, /\n {4}/);
    t.end();
});

test('a minify failure throws instead of returning undefined source', (t) => {
    // uglify-js reports failures via result.error instead of throwing;
    // swallowing it used to send {source: undefined} down the pipeline,
    // which exploded later at the deps step as a bogus "Failed to parse".
    t.throws(
        () =>
            transform(
                {
                    source: '"use strict"; delete undefined;',
                    filename: 'broken.js',
                    map: null,
                },
                {}
            ),
        /uglify-js failed on broken\.js/
    );
    t.end();
});
