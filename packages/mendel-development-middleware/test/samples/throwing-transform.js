// Fixture transform: fails on demand so tests can break a build deterministically.
module.exports = function ({ source, filename }) {
    if (source.indexOf('MENDEL_BREAK_ME') >= 0) {
        throw new SyntaxError(`Unexpected token while parsing ${filename}`);
    }
    return { source };
};
