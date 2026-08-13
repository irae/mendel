// Extensions covered by Mendel's own first-party parser packages. This is a
// hint, not a general plugin registry: it exists only because a project that
// hasn't installed a parser yet can't be introspected to discover what it
// would have handled. Keep in sync with each package's own `.extensions`
// (mendel-parser-json, mendel-parser-plaintext).
module.exports = {
    '.json': 'mendel-parser-json',
    '.md': 'mendel-parser-plaintext',
    '.markdown': 'mendel-parser-plaintext',
    '.txt': 'mendel-parser-plaintext',
    '.csv': 'mendel-parser-plaintext',
    '.tsv': 'mendel-parser-plaintext',
    '.html': 'mendel-parser-plaintext',
    '.hbs': 'mendel-parser-plaintext',
    '.handlebars': 'mendel-parser-plaintext',
    '.mustache': 'mendel-parser-plaintext',
    '.ejs': 'mendel-parser-plaintext',
    '.graphql': 'mendel-parser-plaintext',
    '.gql': 'mendel-parser-plaintext',
};
