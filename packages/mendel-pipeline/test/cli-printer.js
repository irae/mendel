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
        const printer = new CliPrinter();
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

tap.test('renders a report when every measurement took zero time', (t) => {
    const printer = new CliPrinter();
    const data = [
        { name: '1:groupA:sub', before: 5, after: 5 },
        { name: '1:groupB:sub', before: 7, after: 7 },
    ];

    let output = '';
    t.doesNotThrow(() => {
        output = captureConsoleLog(() => printer.print(data));
    }, 'a zero total duration does not throw');
    t.match(output, /0%/, 'percentages fall back to 0%');
    t.notMatch(output, /NaN/, 'no NaN leaks into the report');
    t.end();
});

tap.test('a failing printer cannot fail the process on exit', (t) => {
    const collector = require('../src/helpers/analytics/analytics-collector');
    const originalOptions = collector.options;
    const originalError = console.error;
    const errors = [];

    collector.data.push({
        name: '1:groupA:sub',
        pid: 1,
        before: 0,
        after: 1,
    });
    collector.setOptions({
        printer: {
            print() {
                throw new Error('printer exploded');
            },
        },
    });
    console.error = (...args) => errors.push(args);

    try {
        t.doesNotThrow(
            () => collector.onExit(),
            'a throwing printer does not propagate out of the exit handler'
        );
        t.equal(errors.length, 1, 'the failure is reported, not silenced');
        t.match(
            errors[0],
            [/Analytics printer error/, Error],
            'the original error is surfaced for debugging'
        );
    } finally {
        console.error = originalError;
        collector.data.length = 0;
        collector.setOptions(originalOptions);
    }

    t.end();
});

tap.test('handles narrow terminal widths without throwing RangeError', (t) => {
    const printer = new CliPrinter();
    const data = [
        { name: '1:groupA:sub', before: 0, after: 300 },
        { name: '1:groupB:sub', before: 0, after: 700 },
    ];

    const originalColumns = process.stdout.columns;

    t.test('narrow terminal (30 columns)', (t) => {
        Object.defineProperty(process.stdout, 'columns', {
            value: 30,
            configurable: true,
        });

        try {
            let errorThrown = false;
            let output = '';

            try {
                output = captureConsoleLog(() => printer.print(data));
            } catch (err) {
                errorThrown = true;
                t.fail(`Should not throw, but got: ${err.message}`);
            }

            t.notOk(errorThrown, 'does not throw RangeError');
            t.ok(output.length > 0, 'produces output');
            t.notMatch(
                output,
                /undefined/,
                'output does not contain undefined'
            );
        } finally {
            Object.defineProperty(process.stdout, 'columns', {
                value: originalColumns,
                configurable: true,
            });
        }

        t.end();
    });

    t.test('moderate narrow terminal (40 columns)', (t) => {
        Object.defineProperty(process.stdout, 'columns', {
            value: 40,
            configurable: true,
        });

        try {
            let errorThrown = false;
            let output = '';

            try {
                output = captureConsoleLog(() => printer.print(data));
            } catch (err) {
                errorThrown = true;
                t.fail(`Should not throw, but got: ${err.message}`);
            }

            t.notOk(errorThrown, 'does not throw RangeError');
            t.ok(output.length > 0, 'produces output');
            t.notMatch(
                output,
                /undefined/,
                'output does not contain undefined'
            );
        } finally {
            Object.defineProperty(process.stdout, 'columns', {
                value: originalColumns,
                configurable: true,
            });
        }

        t.end();
    });

    t.end();
});
