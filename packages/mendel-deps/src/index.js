let debugFileMatching = process.env.DEBUG_FILE_MATCHING;
if (debugFileMatching && debugFileMatching !== '') {
    debugFileMatching = new RegExp(debugFileMatching);
}
const debug = require('debug')('mendel:deps');
const path = require('path');
const jsDependency = require('./javascript');
const cssDependency = require('./css');

const builtInModules = ['global'].concat(require('repl')._builtinLibs);

function isSupported(extension) {
    return (
        jsDependency.supports.has(extension) ||
        cssDependency.supports.has(extension)
    );
}

function getDependencies(filePath, source) {
    const ext = path.extname(filePath);
    if (jsDependency.supports.has(ext)) {
        return jsDependency(source, filePath);
    } else if (cssDependency.supports.has(ext)) {
        return cssDependency(source, filePath);
    }
    return { imports: [], exports: [] };
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
module.exports = function deps({ file, resolver, source }) {
    return Promise.resolve()
        .then(() => getDependencies(file, source))
        .catch((e) => {
            debug(e);
            return { imports: [], exports: [] };
        })
        .then((result) => {
            if (debugFileMatching && debugFileMatching.test(file)) {
                debug({ file, result });
            }
            const { imports } = result;
            const promises = imports.map((importLiteral) => {
                return resolver.resolve(importLiteral).catch(() => {
                    if (!builtInModules.includes(importLiteral)) {
                        if (
                            source.indexOf('MODULE_NOT_FOUND') >= 0 &&
                            source.indexOf('typeof require&&require') >= 0
                        ) {
                            const pattern = new RegExp(
                                `[{,"]${importLiteral}"?:\\d`
                            );
                            /*
                                assuming it is a minified file with indexes

                                instead of requiring the file itself
                                Minifined files have maps and include their on
                                dependency as following (but without spaces):
                                {
                                    './implementation': 66,
                                    'react': 13,
                                    "@babel/runtime/helpers/typeof": 29,
                                    has: 61,
                                }
                            */
                            if (pattern.test(source)) return false;
                        }
                        console.warn(
                            `Warning: Can't find ${importLiteral} from ${file}`
                        );
                    }
                    return false;
                });
            });

            return Promise.all(promises).then((resolvedImports) => {
                const importMap = {};
                resolvedImports.forEach((resolvedImport, index) => {
                    importMap[imports[index]] = resolvedImport;
                });

                return importMap;
            });
        });
};

module.exports.isSupported = isSupported;
