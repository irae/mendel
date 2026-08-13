const test = require('tap').test;
const fs = require('fs');
const os = require('os');
const path = require('path');
const PlaintextParser = require('../');

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

function roundtrip(t, source) {
    const result = PlaintextParser({ source });
    const file = path.join(
        os.tmpdir(),
        `mendel-parser-plaintext-${Date.now()}-${Math.random()}.js`
    );
    fs.writeFileSync(file, result.source);
    t.teardown(() => fs.unlinkSync(file));
    delete require.cache[require.resolve(file)];
    return require(file);
}

test('plain text file round-trips exactly', function (t) {
    const source = 'hello world\nsecond line\n';
    t.equal(roundtrip(t, source), source);
    t.end();
});

test('embedded quotes, backslashes, newlines, and tabs survive', function (t) {
    const source = 'He said "hi"\n\\path\\to\\file\ttabbed\nnewline above';
    t.equal(roundtrip(t, source), source);
    t.end();
});

test('U+2028 and U+2029 are escaped in the emitted source', function (t) {
    const source = `before${LINE_SEPARATOR}mid${PARAGRAPH_SEPARATOR}after`;
    const result = PlaintextParser({ source });

    t.notOk(
        result.source.includes(LINE_SEPARATOR),
        'raw U+2028 does not appear in emitted source'
    );
    t.notOk(
        result.source.includes(PARAGRAPH_SEPARATOR),
        'raw U+2029 does not appear in emitted source'
    );
    t.match(result.source, /\\u2028/);
    t.match(result.source, /\\u2029/);
    t.equal(roundtrip(t, source), source);
    t.end();
});

test('empty file works', function (t) {
    t.equal(roundtrip(t, ''), '');
    t.end();
});

test('text that looks like JS code is emitted inertly as a string', function (t) {
    const source =
        "console.log('should not execute'); module.exports = require('fs');";
    const result = roundtrip(t, source);
    t.type(result, 'string');
    t.equal(result, source);
    t.end();
});

test('PlaintextParser declares the mendel parser contract', function (t) {
    t.equal(PlaintextParser.parser, true);
    t.equal(PlaintextParser.compatible, '.js');
    t.ok(Array.isArray(PlaintextParser.extensions));
    t.ok(PlaintextParser.extensions.includes('.md'));
    t.ok(PlaintextParser.extensions.includes('.graphql'));
    t.end();
});
