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

// The inliner replaces `process.env.<name>` with `process.env[name]` as a
// literal, which only works for strings and undefined:
//
//   regular: process.env.NODE_ENV === "production"
//         -> "production" === "production"
//   complex: process.env.hasOwnProperty("FOO") && process.env.FOO === "yes"
//         -> process.env.hasOwnProperty("FOO") && undefined === "yes"
//
// In the complex case `hasOwnProperty` is not an env var but a function
// inherited from Object.prototype, which Babel cannot turn into a node. List
// every such inherited name for the inliner's `exclude`, so those reads stay
// at runtime, unless an env var of that name actually exists.
function inheritedEnvKeys() {
    const keys = new Set();
    for (
        let proto = Object.getPrototypeOf(process.env);
        proto;
        proto = Object.getPrototypeOf(proto)
    ) {
        Object.getOwnPropertyNames(proto).forEach((key) => keys.add(key));
    }
    return Array.from(keys).filter(
        (key) => !Object.prototype.hasOwnProperty.call(process.env, key)
    );
}

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
        plugins: [stripEnvDelete, [inliner, { exclude: inheritedEnvKeys() }]],
    });

    return { source: code, map };
};
