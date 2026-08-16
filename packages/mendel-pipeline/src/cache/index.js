const path = require('path');
const { EventEmitter } = require('events');
const { Minimatch } = require('minimatch');
const verbose = require('debug')('verbose:mendel:cache');
const extraVerbose = require('debug')('debug:mendel:cache');

const debugFilter = require('mendel-development/debug-filter');
const Entry = require('./entry');
const variationMatches = require('mendel-development/variation-matches');
const RUNTIME = ['main', 'browser', 'module'];

class MendelCache extends EventEmitter {
    constructor(config) {
        super();
        this.projectRoot = config.projectRoot;
        this.environment = config.environment;

        this._store = new Map();
        // Kept in step with `entry.error` so `deliverableSize` stays O(1) on
        // the per-message hot path in cache/server.js.
        this._erroredCount = 0;
        this._normalizedIdToEntryIds = new Map();
        // PackageMap maps a source to a normalizedId
        // that allows to group sources that they are the "same"
        // so a depdenecy can resolve to different file in different runtime
        this._packageMap = new Map();
        // In a package.json, you can define broswer property that
        // is an object with a source path as a key and `false` as a value
        // to depict DO NOT bundle
        this._depIgnoreMap = new Map();
        // Similar to packageMap but this pertains to dependency out of
        // current module's source paths like sibling or ancestors.
        // In such cases, a destination package may not be used for
        // only one runtime.
        this._moduleAliasMap = new Map();

        this._baseConfig = config.baseConfig;
        this._variations = config.variationConfig.variations;
        this._shimPathToId = new Map();
        Object.keys(config.shim).forEach((shimId) => {
            // "process" and "node:process" share one shim file; the first
            // (unprefixed) id must stay the file's normalizedId — outlets
            // key global handling on it (e.g. the browser-pack "process"
            // prelude).
            if (!this._shimPathToId.has(config.shim[shimId]))
                this._shimPathToId.set(config.shim[shimId], shimId);
            this._shimPathToId.set(shimId, shimId);
        });
        this._types = config.types;

        const ignores = Array.isArray(config.ignores)
            ? config.ignores
            : [config.ignores];
        this._ignores = ignores.map((ignore) => {
            const negate = ignore[0] === '!';
            ignore = ignore.slice(negate);
            let pattern = negate ? '!' : '';
            if (!ignore.startsWith('**/')) pattern += '**/';
            pattern += ignore;
            return new Minimatch(pattern);
        });
    }

    _testForIgnore(id) {
        if (id.startsWith('./')) id = id.slice(2);
        const globs = this._ignores;
        return (
            globs.filter(({ negate }) => !negate).some((g) => g.match(id)) &&
            globs.filter(({ negate }) => negate).every((g) => g.match(id))
        );
    }

    // Get Type only based on the entryId. IST can convert the types.
    getInitialType(id) {
        const nodeModule = isNodeModule(id);
        // Find type as if node module was a source
        if (nodeModule)
            id = '.' + id.slice(id.lastIndexOf('node_modules') + 12);
        const type = Entry.getTypeForConfig(this._types, id);
        return {
            type: nodeModule ? 'node_modules' : type,
            // Secondary type: type as if node_modules was a source
            _type: type,
        };
    }

    // Please, don't use this function except to calculate package.json maps
    _getBeforePackageJSONNormalizedId(id) {
        if (isNodeModule(id)) return id;
        let normalizedId = id;
        const match = variationMatches(this._variations, id);
        // A boundary-only match (id ends exactly at the variation dir) has
        // no file component to normalize; running it through path.parse/join
        // would collapse the id to './.'.
        if (match && match.file) {
            const parts = path.parse(match.file);
            // some people like to directly require package.json 😱
            // and we don't want to give back module entry
            if (parts.base === 'package.json') return id;
            if (parts.name === 'index') normalizedId = './' + parts.dir;
            // Strip extension
            else normalizedId = './' + path.join(parts.dir, parts.name);
        }

        debugFilter(verbose, `resolved ${id} to ${normalizedId}`);

        return normalizedId;
    }

    getNormalizedId(id) {
        // For node's packages and shims, normalizedId will resolve to its respective package name
        if (this._shimPathToId.has(id)) return this._shimPathToId.get(id);
        if (this._packageMap.has(id)) {
            const to = this._packageMap.get(id).mapToId;
            debugFilter(verbose, `_packageMap from ${id} to ${to} `);
            return to;
        }
        return this._getBeforePackageJSONNormalizedId(id);
    }

    getVariation(path) {
        const match = variationMatches(this._variations, path);
        if (match) return match.variation.id;
        return false;
    }

    addEntry(id) {
        if (this._testForIgnore(id) || this.hasEntry(id)) return;
        const entry = new Entry(id);

        // normalize based on variation and environment
        entry.variation = this.getVariation(id);
        entry.normalizedId = this.getNormalizedId(id);
        entry.runtime = this.getRuntime(id);
        const type = this.getInitialType(id);
        entry.type = type.type;
        entry._type = type._type;

        // fast lookup cache per normalized id
        if (!this._normalizedIdToEntryIds.has(entry.normalizedId)) {
            this._normalizedIdToEntryIds.set(entry.normalizedId, []);
        }
        this._normalizedIdToEntryIds.get(entry.normalizedId).push(entry.id);

        // finally
        this._store.set(id, entry);
        this.emit('entryAdded', id);
        debugFilter(extraVerbose, { entry }, id);
    }

    _reindexNormalizedId(entry, normalizedId) {
        const previous = this._normalizedIdToEntryIds.get(entry.normalizedId);
        if (previous) {
            const index = previous.indexOf(entry.id);
            if (index >= 0) previous.splice(index, 1);
        }
        entry.normalizedId = normalizedId;
        if (!this._normalizedIdToEntryIds.has(normalizedId)) {
            this._normalizedIdToEntryIds.set(normalizedId, []);
        }
        this._normalizedIdToEntryIds.get(normalizedId).push(entry.id);
    }

    // package.json runtime fields can rewrite an entry's identity after the
    // entry was added (and possibly synced): keep the index in step and
    // re-send done entries so client registries agree with newer dep edges
    _adoptPackageIdentity(id, normalizedId, runtime) {
        const existing = this.getEntry(id);
        if (!existing) return;
        existing.runtime = runtime;
        if (existing.normalizedId !== normalizedId) {
            this._reindexNormalizedId(existing, normalizedId);
            if (existing.done) this.emit('doneEntry', existing);
        }
    }

    invariantTwoPackagesSameTarget(packageNormId, targetNormId) {
        verbose(`invariantTwoPackagesSameTarget`, {
            packageNormId,
            targetNormId,
        });
        const existing = this._packageMap.get(targetNormId);
        if (existing && existing.mapToId !== packageNormId) {
            throw new Error(
                [
                    'Invariant: Found 2 `package.json` targeting same normalizedId',
                    '\n',
                    `${packageNormId} -> ${targetNormId}`,
                    `${existing.mapToId} -> ${targetNormId}`,
                    '\n',
                ].join(' ')
            );
        }
    }

    getRuntime(id) {
        let runtime = 'isomorphic';
        if (this._packageMap.has(id)) {
            runtime = this._packageMap.get(id).runtime;
        }
        if (path.parse(id).base === 'package.json') runtime = 'package';
        debugFilter(verbose, `${id} runtime ${runtime}`);
        return runtime;
    }

    doneEntry(id) {
        const entry = this.getEntry(id);
        entry.done = true;
        this.emit('doneEntry', entry);
    }

    _requestEntry(id) {
        if (id && !this.hasEntry(id)) {
            this.emit('entryRequested', id);
        }
    }

    hasEntry(id) {
        return this._store.has(id);
    }

    removeEntry(id, { final = false } = {}) {
        if (this.hasEntry(id)) {
            if (this.getEntry(id).error) this._erroredCount--;
            this._store.delete(id);
            this.emit('entryRemoved', id, { final });
        }
    }

    size() {
        return this._store.size;
    }

    entries() {
        return Array.from(this._store.values());
    }

    // Entries a client can ever receive: an errored entry never reaches the
    // "done" step, so it must not be counted towards a client's sync target.
    deliverableEntries() {
        return this.entries().filter((entry) => !entry.error);
    }

    deliverableSize() {
        return this._store.size - this._erroredCount;
    }

    getEntry(id) {
        return this._store.get(id);
    }

    getEntriesByNormId(normId) {
        return this._normalizedIdToEntryIds.get(normId);
    }

    setEntryType(id, newType) {
        if (!this.hasEntry(id)) return;
        const entry = this.getEntry(id);
        entry.type = newType;
    }

    setEntryError(id, error) {
        if (!this.hasEntry(id)) return;
        const entry = this.getEntry(id);
        const wasErrored = !!entry.error;
        const isErrored = !!error;
        if (wasErrored !== isErrored) this._erroredCount += isErrored ? 1 : -1;
        entry.error = error;
        entry.done = false;
        this.emit('entryErrored', { id, error });
    }

    /**
     * Certain project or module creates alias of its dependency
     * using package.json's "browser" property. Since the alias is
     * scope to the project, it cannot use global concept of normalizedId
     * but should use a special mapping. For easier search, we use RegExp
     * and key by "<moduleRoot>/<aliasName>" as key to the alias map.
     *
     * e.g.,
     * "browser": {
     *      "unexisting": "existing"
     * }
     * and in the code, `require('unexisting');` should resolve
     * to `existing`.
     *
     * For instance: "./node_modules/superagent/emitter" is one.
     * https://github.com/visionmedia/superagent/blob/36ce8782842c2fee402013ff0650d7f8b310e3a7/package.json#L53-L57
     **/
    _applyModuleAlias(id, depKey, depObject) {
        const match = id.match(/(.*\/node_modules\/[^/]+)\/\S+$/);
        if (!match || match.length !== 2) return depObject;
        const key = path.join(match[1], depKey);
        if (!this._moduleAliasMap.has(key)) return depObject;

        if (typeof depObject !== 'object') {
            depObject = {
                main: false,
                browser: false,
            };
        }

        const { to, runtime } = this._moduleAliasMap.get(key);
        depObject[runtime] = to;
        return depObject;
    }

    // Deal with package.json having {main, browser, etc}
    _handleDependency(oDep, depName) {
        const isPkgModule = !!oDep.packageJson;
        // Gather metadata on package if a package.json was never
        // visited even once.
        if (isPkgModule && this.hasEntry(oDep.packageJson)) {
            debugFilter(verbose, 'isPkgModule && hasEntry ' + depName);
            return;
        }
        // If oDependency is not added yet,
        isPkgModule && this._requestEntry(oDep.packageJson);
        isPkgModule && oDep.module && this._requestEntry(oDep.module);
        let isIsomorphic = false;
        if (typeof oDep.browser === 'object') {
            const val = oDep.browser[oDep.main];
            isIsomorphic = typeof val === 'undefined' || val === false;
        } else if (typeof oDep.browser === 'string') {
            isIsomorphic = oDep.main === oDep.browser;
        }

        const shouldLog = debugFilter(
            verbose,
            { depName, oDep, isIsomorphic },
            depName,
            oDep
        );

        RUNTIME
            // dep can have false as a value in which case indicates not found modules
            .filter((runtime) => oDep[runtime])
            .forEach((runtime) => {
                const dep = oDep[runtime];
                if (typeof dep === 'string') {
                    shouldLog && verbose(`${runtime} for ${dep}`);
                    if (isPkgModule && !isIsomorphic) {
                        const name = path.dirname(oDep.packageJson);

                        // first mapping wins: the "module" runtime falls back
                        // to the main file, and letting it overwrite would
                        // strand the main file at runtime "module", which
                        // browser/main graph walks exclude
                        if (
                            name &&
                            !(
                                this._packageMap.has(dep) &&
                                this._packageMap.get(dep).mapToId === name
                            )
                        ) {
                            this._packageMap.set(dep, {
                                mapToId: name,
                                runtime,
                            });
                            shouldLog &&
                                verbose(`${dep} adopts ${name} (${runtime})`);
                            this._adoptPackageIdentity(dep, name, runtime);
                        }
                    }

                    this._requestEntry(dep);
                } else {
                    // This code path when dependency in a runtime
                    // contains a mapping of source to another within a module.
                    // It often pertains to node modules like superagent.
                    // https://github.com/visionmedia/superagent/blob/36ce8782842c2fee402013ff0650d7f8b310e3a7/package.json#L53-L57
                    Object.keys(dep).forEach((fromDep) => {
                        const toDep = dep[fromDep];
                        if (typeof toDep === 'undefined') {
                            return;
                        } else if (toDep === false) {
                            // a browser-field `false` exclusion only covers
                            // requires made from inside the declaring package
                            // (e.g. bn.js maps buffer:false for its own
                            // feature detection, not for the whole graph)
                            const scope = path.dirname(oDep.packageJson) + '/';
                            this._depIgnoreMap.set(
                                fromDep,
                                (
                                    this._depIgnoreMap.get(fromDep) || new Set()
                                ).add(scope + '\0' + runtime)
                            );
                        } else if (!/^\.\.?\//.test(fromDep)) {
                            // fromDep is a bare module name only when it never
                            // resolved to a path; resolved paths outside the
                            // project root start with "../" and are still
                            // file mappings, not module aliases
                            // This is the case where node module mapping exists
                            // but it points to unexisting module.
                            // e.g.,
                            // "browser": {
                            //      "unexisting": "existing"
                            // }
                            // and in the code, `require('unexisting');` should resolve
                            // to `existing`.
                            this._moduleAliasMap.set(
                                // Makes something like './node_modules/module'
                                path.join(
                                    path.dirname(oDep.packageJson),
                                    fromDep
                                ),
                                {
                                    to: toDep,
                                    runtime,
                                }
                            );
                        } else {
                            const mapToId = this.getNormalizedId(fromDep);
                            this._packageMap.set(toDep, {
                                mapToId,
                                runtime,
                            });
                            this._packageMap.set(fromDep, {
                                mapToId,
                                runtime: 'main',
                            });
                            this._adoptPackageIdentity(toDep, mapToId, runtime);
                            this._adoptPackageIdentity(
                                fromDep,
                                mapToId,
                                'main'
                            );
                        }
                        this._requestEntry(toDep);
                    });
                }
            });
    }

    setSource(id, source, deps, map) {
        const entry = this.getEntry(id);
        const normDep = new Dependencies();

        const shouldLog = debugFilter(verbose, `dep postprocess ${id}`);

        /********
         * TODO: Fix mendel-exec usecase (see mendel-deps/index)
         * Somewhere in the dependency treee we are marking the dep in
         * a way that causes the client registry to not receive a copy
         * of the `main` runtime version of a file.
         * ******/

        Object.keys(deps)
            // mod = module name or require literal
            .forEach((mod) => {
                const dep = (deps[mod] = this._applyModuleAlias(
                    id,
                    mod,
                    deps[mod]
                ));
                if (shouldLog && deps[mod] !== dep) {
                    verbose({ aliasedFrom: deps[mod], to: dep });
                }
                if (
                    typeof dep === 'object' &&
                    this._depIgnoreMap.has(dep.main)
                ) {
                    const set = this._depIgnoreMap.get(dep.main);
                    set.forEach((scopedRuntime) => {
                        const [scope, runtime] = scopedRuntime.split('\0');
                        if (id.startsWith(scope)) dep[runtime] = false;
                    });
                    shouldLog && verbose(`in ignore map ${mod}`);
                }
                this._handleDependency(dep, mod);

                normDep[mod] = new Dependency();
                RUNTIME.forEach((runtime) => {
                    let rtDep = dep && dep[runtime];
                    if (rtDep === false) return (normDep[mod][runtime] = false);

                    // When we add entries, we add them index them by normalizedId.
                    // Because of normalizedId, even in the package.json case where multiple
                    // runtimes can point to different sources, we can use normalizedId
                    // to map it back, thus, it should be sufficient to use any version of dep
                    // to generate normalizedId when we store.
                    // The resolver will pick the right runtime entry.
                    // main is "false" when depdenecy is a node's core module.
                    rtDep = typeof rtDep === 'string' ? rtDep : dep.main;
                    normDep[mod][runtime] = this.getNormalizedId(rtDep || mod);
                });
            });

        entry.setSource(source, normDep, map);
        debugFilter(extraVerbose, this.getEntry(id), id);
    }

    emit(eventName, entry) {
        if (entry && entry.id) {
            debugFilter(
                verbose,
                [eventName, entry.id, entry.normalizedId || ''].join(' ')
            );
        } else if (entry) {
            debugFilter(verbose, [eventName, entry].join(' '));
        } else {
            verbose(eventName);
        }
        super.emit.apply(this, arguments);
    }

    debug() {
        Array.from(this._store.values()).forEach((entry) => {
            console.log(entry.id);
            console.log('  norm: ' + entry.normalizedId);
            console.log('  var: ' + entry.variation);
            console.log('  sources:');
            console.log(entry.source);
        });
    }
}

function isNodeModule(id) {
    return id.indexOf('node_modules') >= 0;
}

module.exports = MendelCache;

class Dependency {}

class Dependencies {}
