const tap = require('tap');
const CliPrinter = require('../src/helpers/analytics/cli-printer');

function captureConsoleLog(fn) {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
        fn();
    } finally {
        console.log = original;
    }
    return lines.join('\n');
}

tap.test(
    'renders bar/separator glyphs instead of undefined interop artifacts',
    (t) => {
        const printer = new CliPrinter({ enableColor: false });
        const data = [
            { name: '1:groupA:sub', before: 0, after: 300 },
            { name: '1:groupB:sub', before: 0, after: 700 },
        ];

        const output = captureConsoleLog(() => printer.print(data));

        t.match(output, /█/, 'bar chart renders the square glyph');
        t.match(output, /─/, 'footer renders the line glyph');
        t.notMatch(
            output,
            /undefined/,
            'no undefined interop artifacts leak into output'
        );
        t.end();
    }
);
