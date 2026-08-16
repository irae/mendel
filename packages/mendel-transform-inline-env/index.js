const babelCore = require('@babel/core');
const inliner = require('babel-plugin-transform-inline-environment-variables');

// The inliner rewrites the member expression inside `delete process.env.X`
// into a value literal (`delete undefined` when X is unset), a strict-mode
// syntax error that breaks any later parse (e.g. minification). Replace the
// whole delete with its result before the inliner visits it.
const stripEnvDelete = {
    visitor: {
        UnaryExpression(path) {
            const { node } = path;
            if (node.operator !== 'delete') return;
            const arg = node.argument;
            if (
                arg.type === 'MemberExpression' &&
                arg.object.type === 'MemberExpression' &&
                arg.object.object.type === 'Identifier' &&
                arg.object.object.name === 'process' &&
                arg.object.property.type === 'Identifier' &&
                arg.object.property.name === 'env'
            ) {
                path.replaceWith(babelCore.types.booleanLiteral(true));
            }
        },
    },
};

module.exports = function ({ source, filename, map: inputSourceMap }) {
    if (source.indexOf('process.env') === -1) {
        return { source, map: inputSourceMap };
    }

    const { code, map } = babelCore.transform(source, {
        babelrc: false, // babelrc is ignored and needs to be configured only with the option
        sourceMaps: true, // We don't need inline as we store them separately
        ast: false,
        // babel rejects null; pipeline may pass map: null for first transform
        inputSourceMap: inputSourceMap || undefined,
        filename,
        sourceFileName: filename, // sourcemap contains filename this way
        plugins: [stripEnvDelete, inliner],
    });

    return { source: code, map };
};
