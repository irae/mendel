const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(0x5c);

function PlaintextParser({ source } /*, options */) {
    // U+2028/U+2029 are valid inside a JS string literal but JSON.stringify
    // leaves them raw; both break when the emitted module lands inside an
    // inline <script> or a JSONP-style response, so they must be escaped.
    const encoded = JSON.stringify(source)
        .split(LINE_SEPARATOR)
        .join(BACKSLASH + 'u2028')
        .split(PARAGRAPH_SEPARATOR)
        .join(BACKSLASH + 'u2029');

    return {
        source: `module.exports = ${encoded}`,
    };
}

PlaintextParser.parser = true;
PlaintextParser.extensions = [
    '.md',
    '.markdown',
    '.txt',
    '.csv',
    '.tsv',
    '.html',
    '.hbs',
    '.handlebars',
    '.mustache',
    '.ejs',
    '.graphql',
    '.gql',
];
PlaintextParser.compatible = '.js';

module.exports = PlaintextParser;
