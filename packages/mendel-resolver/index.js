const verbose = require('debug')('verbose:mendel:resolver:base');
const path = require('path');
const { stat, readFile } = require('fs');
const debugFilter = require('mendel-development/debug-filter');

function withPrefix(path) {
    if (/^\w[^:]/.test(path)) path = './' + path;
    return path;
}

// Mendel emits CommonJS (browser-pack / m.wrap), so every runtime prefers
// the "require" condition; only the "module" runtime may pick ESM entries,
// mirroring how the legacy "module" field is treated.
const RUNTIME_CONDITIONS = {
    main: ['node', 'require', 'default'],
    browser: ['browser', 'require', 'default'],
    module: ['module', 'import', 'default'],
};

function conditionsFor(runtime) {
    return RUNTIME_CONDITIONS[runtime] || [runtime, 'require', 'default'];
}

function normalizeExports(exports) {
    if (typeof exports === 'string' || Array.isArray(exports))
        return { '.': exports };
    if (typeof exports !== 'object' || exports === null) return null;
    const keys = Object.keys(exports);
    const subpathKeys = keys.filter((key) => key[0] === '.');
    if (subpathKeys.length === 0) return { '.': exports };
    // mixing "./subpath" and condition keys is invalid per Node
    if (subpathKeys.length !== keys.length) return null;
    return exports;
}

function matchExportsSubpath(exportsMap, subpath) {
    if (Object.prototype.hasOwnProperty.call(exportsMap, subpath))
        return { target: exportsMap[subpath], patternMatch: null };

    // Node's PATTERN_KEY_COMPARE: the pattern with the longest static
    // prefix (then longest suffix) wins over other matching patterns.
    let best = null;
    Object.keys(exportsMap).forEach((key) => {
        const starIndex = key.indexOf('*');
        if (starIndex < 0 || key.indexOf('*', starIndex + 1) >= 0) return;
        const prefix = key.slice(0, starIndex);
        const suffix = key.slice(starIndex + 1);
        if (subpath.length < prefix.length + suffix.length) return;
        if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return;
        if (
            !best ||
            prefix.length > best.prefix.length ||
            (prefix.length === best.prefix.length &&
                suffix.length > best.suffix.length)
        ) {
            best = { key, prefix, suffix };
        }
    });
    if (!best) return null;
    return {
        target: exportsMap[best.key],
        patternMatch: subpath.slice(
            best.prefix.length,
            subpath.length - best.suffix.length
        ),
    };
}

// Walks a target expression depth-first honoring key order. Returns an
// ordered list of candidate paths (array targets contribute alternatives),
// null when the subpath is explicitly blocked, or undefined on no match.
function expandExportsTarget(target, conditions, patternMatch) {
    if (target === null) return null;
    if (typeof target === 'string') {
        if (target.slice(0, 2) !== './') return undefined;
        return [
            patternMatch === null
                ? target
                : target.split('*').join(patternMatch),
        ];
    }
    if (Array.isArray(target)) {
        const candidates = [];
        for (const item of target) {
            const expanded = expandExportsTarget(
                item,
                conditions,
                patternMatch
            );
            if (expanded === null && candidates.length === 0) return null;
            if (expanded) candidates.push(...expanded);
        }
        return candidates.length ? candidates : undefined;
    }
    if (typeof target === 'object') {
        for (const key of Object.keys(target)) {
            if (key !== 'default' && conditions.indexOf(key) < 0) continue;
            const expanded = expandExportsTarget(
                target[key],
                conditions,
                patternMatch
            );
            // undefined means an unmatched nested branch; per Node the
            // search continues with the next sibling condition
            if (expanded !== undefined) return expanded;
        }
        return undefined;
    }
    return undefined;
}

class ModuleResolver {
    /**
     * @param {Object} options
     * @param {String} options.basedir
     * @param {String[]} options.runtimes
     */
    constructor({
        cwd = process.cwd(),
        basedir = process.cwd(),
        extensions = ['.js', '.cjs', '.mjs'],
        runtimes = ['main', 'module', 'browser'],
        recordPackageJson = false,
    } = {}) {
        this.extensions = extensions;
        this.cwd = cwd;
        // in case basedir is relative, we want to make it relative to the cwd.
        this.basedir = path.resolve(this.cwd, basedir);
        this.runtimes = runtimes;
        this.recordPackageJson = recordPackageJson;
    }

    static pStat(filePath) {
        return new Promise((resolve, reject) => {
            stat(filePath, (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }

    static pReadFile(filePath, options = {}) {
        return new Promise((resolve, reject) => {
            readFile(filePath, options, (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }

    /***
     * isNodeModule refers to detecting npm/yarn/pnpm modules.
     * It does not check for 'node_modules' because its input is
     * the string in `require('mod')` or `import * from 'mod'`.
     * If it is not one of the following, it is a module:
     *      * ./relative/path
     *      * ../another/relative/path
     *      * /absolute/path
     *      * C:\absolute\windows\path
     *      * C:/another/windows/path
     ***/
    static isNodeModule(name) {
        return !/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\/])/.test(name);
    }

    setBaseDir(basedir) {
        this.basedir = path.resolve(this.cwd, basedir);
    }

    /**
     * @param {String} moduleName name of the module to resolve its path
     */
    resolve(moduleName) {
        let promise;
        if (!ModuleResolver.isNodeModule(moduleName)) {
            const moduleAbsPath = path.resolve(this.basedir, moduleName);
            promise = this.resolveFile(moduleAbsPath).catch(() =>
                this.resolveDir(moduleAbsPath)
            );
        } else {
            promise = this.resolveNodeModules(moduleName);
        }
        return (
            promise
                // Post process
                .then((deps) => {
                    // Make the path relative to the `basedir`. Nested
                    // resolve() calls already produced cwd-relative paths;
                    // bare module names (like "path") have no real path.
                    // Only absolute paths still need relativizing, and
                    // re-processing the others would resolve them against
                    // process.cwd() and corrupt the output.
                    const relativize = (value) =>
                        path.isAbsolute(value)
                            ? withPrefix(path.relative(this.cwd, value))
                            : value;
                    Object.keys(deps)
                        .filter((rt) => deps[rt])
                        .forEach((rt) => {
                            if (typeof deps[rt] === 'string') {
                                deps[rt] = relativize(deps[rt]);
                            } else if (typeof deps[rt] === 'object') {
                                const rtDep = deps[rt];
                                Object.keys(rtDep)
                                    .filter((key) => rtDep[key])
                                    .forEach((depKey) => {
                                        const newKey = relativize(depKey);
                                        const newValue = relativize(
                                            rtDep[depKey]
                                        );
                                        delete rtDep[depKey];
                                        rtDep[newKey] = newValue;
                                    });
                            }
                        });
                    return deps;
                })
                .catch(() => {
                    throw new Error(`${moduleName} failed to resolve.`);
                })
        );
    }

    fileExists(filePath) {
        return ModuleResolver.pStat(filePath).then((stat) => {
            if (stat.isFile() || stat.isFIFO()) return filePath;
            throw new Error({
                message: `${filePath} is not a File.`,
                code: 'ENOENT',
            });
        });
    }

    resolveFile(moduleName) {
        let promise = this.fileExists(moduleName);
        this.extensions.forEach((ext) => {
            promise = promise.catch(() => this.fileExists(moduleName + ext));
        });

        return promise.then((filePath) => {
            const reduced = this.runtimes.reduce((reduced, name) => {
                reduced[name] = filePath;
                return reduced;
            }, {});
            return reduced;
        });
    }

    resolveDir(moduleName) {
        return this.resolvePackageJson(moduleName).catch(() =>
            this.resolveFile(path.join(moduleName, 'index'))
        );
    }

    readPackageJson(dirName) {
        return ModuleResolver.pStat(dirName)
            .then((stat) => {
                if (stat.isFile())
                    return ModuleResolver.pReadFile(dirName, 'utf8');
                throw new Error({
                    message: `${dirName} does not have package.json as a File.`,
                    code: 'ENOENT',
                });
            })
            .then((packageStr) => {
                // if fails to parse, we will hit catch
                return JSON.parse(packageStr);
            });
    }

    resolveExports(moduleDir, pkg, subpath) {
        const exportsMap = normalizeExports(pkg.exports);
        const matched = exportsMap && matchExportsSubpath(exportsMap, subpath);
        const attempts = this.runtimes.map((runtime) => {
            if (!matched) return Promise.resolve(undefined);
            const candidates = expandExportsTarget(
                matched.target,
                conditionsFor(runtime),
                matched.patternMatch
            );
            if (!candidates || !candidates.length)
                return Promise.resolve(undefined);
            let promise = Promise.reject();
            candidates.forEach((candidate) => {
                promise = promise.catch(() =>
                    this.resolveFile(path.join(moduleDir, candidate)).then(
                        (filePaths) => filePaths[runtime]
                    )
                );
            });
            return promise.catch(() => undefined);
        });
        return Promise.all(attempts).then((values) => {
            const resolved = {};
            this.runtimes.forEach((runtime, index) => {
                if (values[index]) resolved[runtime] = values[index];
            });
            return resolved;
        });
    }

    resolvePackageJson(moduleName) {
        const packagePath = path.join(moduleName, '/package.json');
        return this.readPackageJson(packagePath).then((pkg) => {
            const viaExports =
                pkg.exports != null
                    ? this.resolveExports(moduleName, pkg, '.')
                    : Promise.resolve({});
            const viaLegacy = this._resolveLegacyFields(moduleName, pkg).catch(
                () => ({})
            );
            return Promise.all([viaExports, viaLegacy]).then(
                ([exportsResolved, legacyResolved]) => {
                    const resolved = this.runtimes.reduce((reduced, name) => {
                        // mendel's browser field overlay predates "exports"
                        // and remains authoritative for the browser runtime
                        const preferLegacy =
                            name === 'browser' && pkg.browser != null;
                        const first = preferLegacy
                            ? legacyResolved
                            : exportsResolved;
                        const second = preferLegacy
                            ? exportsResolved
                            : legacyResolved;
                        const value =
                            first[name] !== undefined
                                ? first[name]
                                : second[name];
                        if (value !== undefined) reduced[name] = value;
                        return reduced;
                    }, {});

                    if (!Object.keys(resolved).length) {
                        throw new Error(
                            `package.json without "${this.runtimes}" or resolvable "exports"`
                        );
                    }
                    if (this.recordPackageJson)
                        resolved.packageJson = packagePath;
                    debugFilter(verbose, `${moduleName} runtimes`);
                    debugFilter(verbose, resolved, moduleName);
                    return resolved;
                }
            );
        });
    }

    _resolveLegacyFields(moduleName, pkg) {
        return Promise.resolve()
            .then(() => {
                if (this.runtimes.every((name) => !pkg[name])) {
                    throw new Error(`package.json without "${this.runtimes}"`);
                }

                const consider = new Map();
                // A "package.json" can have below data structure
                // {
                //     "main": "./foo",
                //     "browser": {
                //         "./foo": "./bar",
                //         "moduleA": "moduleB",
                //         "./baz": false,
                //         "./abc": "./xyz.js"
                //     }
                // }
                // In case of the main, it should resolve to either "./foo.js" or "./foo/index.js"
                // In case of browser runtime, it should anything that requires "./foo" should map to "./bar.js" or "./bar/index.js"
                this.runtimes
                    .filter((name) => pkg[name])
                    .forEach((name) => {
                        if (typeof pkg[name] === 'string')
                            consider.set(pkg[name]);
                        else if (typeof pkg[name] === 'object') {
                            Object.keys(pkg[name]).forEach((fromPath) => {
                                consider.set(fromPath);
                                if (typeof pkg[name][fromPath] === 'string')
                                    consider.set(pkg[name][fromPath]);
                            });
                        }
                    });
                const furtherPaths = Array.from(consider.keys());
                const furtherResolve = furtherPaths.map((depPath) => {
                    let promise = this.resolve(path.join(moduleName, depPath));
                    if (ModuleResolver.isNodeModule(depPath))
                        promise = promise.catch(() => this.resolve(depPath));
                    return promise.catch(() => false);
                });
                return Promise.all(furtherResolve).then((resolves) => {
                    if (resolves.every((resolve) => resolve === false))
                        throw new Error('None of the path declared resolves');
                    resolves.forEach((resolved, index) => {
                        consider.set(furtherPaths[index], resolved);
                    });

                    return { deps: consider, pkg };
                });
            })
            .then(({ pkg, deps }) => {
                const resolved = this.runtimes.reduce((reduced, name) => {
                    // for almost any package, main will work
                    const runtimeVal = pkg[name] || pkg.main;
                    if (deps.has(runtimeVal))
                        reduced[name] = deps.get(runtimeVal)[name];
                    else if (typeof runtimeVal === 'object') {
                        const obj = (reduced[name] = {});
                        Object.keys(runtimeVal).forEach((key) => {
                            const val = runtimeVal[key];
                            if (!deps.get(key) && !deps.get(val)) return;
                            if (!deps.get(key) && deps.get(val))
                                return (obj[key] = deps.get(val)[name]);
                            if (deps.get(key) && typeof val !== 'string')
                                return (obj[deps.get(key)[name]] = false);
                            obj[deps.get(key)[name]] = deps.get(val)[name];
                        });
                    }
                    return reduced;
                }, {});

                return resolved;
            });
    }

    resolveNodeModules(moduleName) {
        const parts = moduleName.split('/');
        const packageName =
            moduleName[0] === '@' ? parts.slice(0, 2).join('/') : parts[0];
        const subpath = '.' + moduleName.slice(packageName.length);

        const nodeModulePaths = this.getPotentialNodeModulePaths(this.basedir);
        let promise = Promise.reject();
        nodeModulePaths.forEach((nodeModulePath) => {
            promise = promise.catch(() => {
                return ModuleResolver.pStat(nodeModulePath).then((stat) => {
                    if (!stat.isDirectory())
                        throw new Error({
                            message: `${nodeModulePath} is not a directory.`,
                            code: 'ENOENT',
                        });

                    const moduleFullPath = path.join(
                        nodeModulePath,
                        moduleName
                    );
                    const resolveWithoutExports = () =>
                        this.resolveFile(moduleFullPath).catch(() =>
                            this.resolveDir(moduleFullPath)
                        );
                    if (subpath === '.') return resolveWithoutExports();

                    // when "exports" declares subpaths, undeclared ones are
                    // encapsulated even if the file exists on disk
                    const packageDir = path.join(nodeModulePath, packageName);
                    return this.readPackageJson(
                        path.join(packageDir, 'package.json')
                    ).then((pkg) => {
                        if (pkg.exports == null) return resolveWithoutExports();
                        return this.resolveExports(
                            packageDir,
                            pkg,
                            subpath
                        ).then((resolved) => {
                            if (!Object.keys(resolved).length) {
                                throw new Error(
                                    `${subpath} is not exported by ${packageName}`
                                );
                            }
                            return resolved;
                        });
                    }, resolveWithoutExports);
                });
            });
        });

        return promise;
    }

    // From https://github.com/substack/node-resolve
    getPotentialNodeModulePaths(start) {
        const modules = 'node_modules';

        // ensure that `start` is an absolute path at this point,
        // resolving against the process' current working directory
        start = path.resolve(start);

        let prefix = '/';
        if (/^([A-Za-z]:)/.test(start)) {
            prefix = '';
        } else if (/^\\\\/.test(start)) {
            prefix = '\\\\';
        }

        const splitRe = process.platform === 'win32' ? /[/\\]/ : /\/+/;
        const parts = start.split(splitRe);

        const dirs = [];
        for (let i = parts.length - 1; i >= 0; i--) {
            if (modules === parts[i]) continue;
            dirs.push(
                prefix +
                    path.join(
                        path.join.apply(path, parts.slice(0, i + 1)),
                        modules
                    )
            );
        }

        if (process.platform === 'win32') {
            dirs[dirs.length - 1] = dirs[dirs.length - 1].replace(':', ':\\');
        }

        return dirs;
    }
}

module.exports = ModuleResolver;
