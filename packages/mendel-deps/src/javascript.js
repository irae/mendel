// `console` is not included as it works flawlessly in Node and browser.
const GLOBAL_WHITELIST = ['global', 'process'];

// {
//     imports: ['./foo', '../bar', 'baz'],
//     exports: ['helloWorld', 'cruelWorld']
// }
const { default: traverse } = require('@babel/traverse');
function _depFinder(ast) {
    const imports = {};
    const exports = {};
    const globals = {};

    const visitor = {
        ImportDeclaration(nodePath) {
            const { node } = nodePath;
            imports[node.source.value] = true;
        },
        CallExpression(nodePath) {
            const { node } = nodePath;

            // cjs require syntax support
            if (
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments[0].type === 'StringLiteral'
            ) {
                imports[node.arguments[0].value] = true;
            }
        },
        MemberExpression(nodePath) {
            const { node } = nodePath;
            if (
                node.object.type === 'Identifier' &&
                GLOBAL_WHITELIST.indexOf(node.object.name) >= 0
            ) {
                globals[node.object.name] = true;
            }
        },
        ExportNamedDeclaration(nodePath) {
            // export {default as bisect, bisectRight, bisectLeft, bisectCenter} from "./bisect.js";
            const { node } = nodePath;
            if (node.source && node.source.type === 'StringLiteral') {
                imports[node.source.value] = true;
            }
        },
    };

    try {
        traverse(ast, visitor);
    } catch (e) {
        /* c8 ignore start */
        const { message } = e;
        const { loc: { filename } = {} } = ast;
        if (filename) {
            console.error(
                `[Mendel] deps (@babel/traverse) ${message} \n wile parsing: ${filename}`
            );
        } else {
            console.error(`[Mendel] deps (@babel/traverse) ${message}`);
        }
        /* c8 ignore end */
    }

    Object.keys(globals).forEach((use) => {
        imports[use] = true;
    });

    return {
        imports: Object.keys(imports),
        exports: Object.keys(exports),
    };
}

/**
 * Returns a map of imports in a file.
 * The map is keyed by the literal in the import statement to its resolved path
 * using the resolver that was pased.
 * @example of output
 * {
 *   "./foo": "src/foo/index.ts",
 *   "./bar": "src/bar.js",
 *   "../baz.js": "./baz.js"
 * }
 */
const { parse } = require('@babel/parser');
module.exports = function jsDependency(source, filePath) {
    let ast;

    try {
        ast = parse(source, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            allowHashBang: true,
            errorRecovery: true,
            sourceFilename: filePath,
            allowUndeclaredExports: true,
            allowSuperOutsideMethod: true,
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
            allowNewTargetOutsideFunction: true,
            plugins: ['jsx', 'flow'],
        });
    } catch (e) {
        const { message, loc: { line, column } = {} } = e;

        if (message && line && column) {
            console.error(
                `[Mendel] deps (@babel/parser) ${message} ${filePath}:${line}:${column}`
            );
        } else {
            console.error(e);
        }

        return false;
    }

    return _depFinder(ast, filePath);
};

// .cjs: CommonJS dual-package entry (package.json "type":"module" + "main":"*.cjs")
// .mjs: explicit ESM files
module.exports.supports = new Set(['.js', '.jsx', '.esnext', '.cjs', '.mjs']);
