const debug = require('debug')('mendel:outlet:browserpack');
const fs = require('fs');
const path = require('path');
const { Transform } = require('stream');
const { Buffer } = require('buffer');
const browserpack = require('browser-pack');
const INLINE_MAP_PREFIX = '//# sourceMappingURL=data:application/json;base64,';
const TRAILING_MAP_COMMENT_RE =
    /\n?(\/\/[#@] sourceMappingURL=data:application\/json[^\n]*)\s*$/;

// Devtools resolve a module's original source through the script that
// defined it, so each mapped module carries its own map: the module
// becomes a direct eval() whose payload ends with an inline map and a
// sourceURL, giving it a script identity that remaps in place. The map
// sources must share the sourceURL's host or devtools show the
// transformed output instead of the original file.
function evalWrapWithMap(source, map, sourceFile, host) {
    const rel = String(sourceFile || '').replace(/^\.\//, '');
    const sourceUrl = host + rel;
    const sources = (map.sources || [rel]).map((s) => {
        const name = String(s).replace(/^\.\//, '');
        return name.indexOf('://') === -1 ? host + name : name;
    });
    const mapForEval = Object.assign({}, map, {
        file: sourceUrl,
        sources,
    });
    const payload = [
        source,
        INLINE_MAP_PREFIX +
            Buffer.from(JSON.stringify(mapForEval)).toString('base64'),
        '//# sourceURL=' + sourceUrl,
    ].join('\n');
    return 'eval(' + JSON.stringify(payload) + ');';
}

// Devtools walk the bundle from EOF for the sourceMappingURL comment and
// stop at the first non-comment line, so the process/global IIFE appendix
// must close before browser-pack's trailing map comment.
function assembleWrappedPack(packSource, prelude, appendix) {
    let body = packSource;
    let mapComment = '';
    const match = packSource.match(TRAILING_MAP_COMMENT_RE);
    if (match) {
        mapComment = match[1];
        body = packSource.slice(0, match.index);
    }
    let out = prelude + body + appendix;
    if (mapComment) {
        out += '\n' + mapComment + '\n';
    }
    return out;
}

class PaddedStream extends Transform {
    constructor({ prelude = '', appendix = '' }, options) {
        super(options);
        this.prelude = prelude;
        this.appendix = appendix;
        this.chunks = [];
    }
    _transform(chunk, encoding, cb) {
        this.chunks.push(Buffer.from(chunk));
        cb();
    }
    _flush(cb) {
        const packSource = Buffer.concat(this.chunks).toString();
        this.push(
            Buffer.from(
                assembleWrappedPack(packSource, this.prelude, this.appendix)
            )
        );
        cb();
    }
}

function matchVar(entries, multiVariations) {
    for (let i = 0; i < multiVariations.length; i++) {
        const varId = multiVariations[i];
        const found = entries.find((entry) => {
            return entry.variation === varId && entry.runtime !== 'main';
        });
        if (found) return found;
    }
}

function entriesHaveGlobalDep(entryMap, globalName) {
    return Array.from(entryMap.values()).some(({ deps }) => {
        return Object.keys(deps)
            .map((key) => deps[key])
            .some((dep) => dep.browser === globalName);
    });
}
module.exports = class BrowserPackOutlet {
    constructor(options) {
        this.config = options;
        this.sourceHost =
            'mendel://' +
            (path.basename(options.projectRoot || '') || 'mendel') +
            '/';
    }

    perform({ entries, options, id }, variations) {
        return new Promise((resolve, reject) => {
            // globals like, "process", handling
            const hasProcess = entriesHaveGlobalDep(entries, 'process');
            const hasGlobal = entriesHaveGlobalDep(entries, 'global');

            const bundles = this.getPackJSON(entries);

            debug(
                bundles.map(
                    ({ data }) => `[${id}] ${data[0].file} - ${data[0].runtime}`
                )
            );
            const pack = browserpack(
                Object.assign({}, options.browserPackOptions, {
                    raw: true, // since we pass Object instead of JSON string
                    hasExports: true, // exposes `require` globally. Required for multi-bundles.
                })
            );

            let prelude = '';
            let appendix = '';

            if (hasProcess || hasGlobal) {
                prelude = '(function(){';
                appendix = '})();';
            }
            if (hasGlobal || hasProcess) prelude += 'var global=window;';
            if (hasProcess) prelude += 'var process=global.process||{env: {}};';

            if (!this.config.noout && options.outfile) {
                let source = '';
                // If `outfile` exists, output it to appropriate file
                pack.on('error', reject);
                pack.on('data', (buf) => (source += buf.toString()));
                pack.on('end', () => {
                    fs.writeFileSync(
                        options.outfile,
                        assembleWrappedPack(source, prelude, appendix)
                    );
                    resolve();
                });
            } else {
                // Return a stream back if outfile is not declared.
                // You can pipe it or do whatever with it.
                const stream = new PaddedStream({ appendix, prelude });
                pack.pipe(stream);
                setImmediate(() => resolve(stream));
            }

            const arrData = bundles
                .map(({ data }) => matchVar(data, variations))
                // There can be bundle that does not pertain to certain variational chain (and no entry on base var)
                .filter(Boolean);
            this.writeToStream(pack, arrData);
        });
    }

    writeToStream(stream, arrData) {
        if (!arrData.length) {
            stream.end();
            return;
        }

        // Writing null terminates the stream. It is equal to EOF for streams.
        while (arrData.length && stream.write(arrData[0])) {
            // If successfully written, remove written one from the arrData.
            arrData.shift();
        }
        if (arrData.length) {
            stream.once(
                'drain',
                this.writeToStream.bind(this, stream, arrData)
            );
        } else {
            stream.end();
        }
    }

    dataFromItem(item) {
        const deps = {};
        Object.keys(item.deps).forEach((literal) => {
            deps[literal] = item.deps[literal]['browser'];
        });
        if (item.map) {
            item.map.sources = item.map.sources.map((_) => {
                return _.replace(/^\.\//, '');
            });
        }

        // sourceFile is the filename of the original source. Our sourcemaps
        // include it, but files without transforms, including node_modules
        // will need this. Useful specially for performance stack traces.
        const sourceFile = item.id.replace(/^\.\//, '');
        const data = {
            id: item.normalizedId,
            // Clone the object so mutating it does not mutate source entry
            deps,
            runtime: item.runtime,
            file: item.id,
            variation: item.variation || this.config.baseConfig.dir,
            sourceFile,
            source: !item.map
                ? item.source
                : evalWrapWithMap(
                      item.source,
                      item.map,
                      sourceFile,
                      this.sourceHost
                  ),
            entry: item.entry,
            expose: item.expose,
            map: item.map,
        };

        return data;
    }

    getPackJSON(entries) {
        const groupedByNorm = new Map();
        const depToData = new Map();

        entries.forEach((item) => {
            const id = item.normalizedId;
            const data = this.dataFromItem(item);
            const entry = groupedByNorm.get(id) || {
                id: item.normalizedId,
                variations: [],
                data: [],
            };

            if (entry.variations.includes(data.variation)) {
                return debug(
                    [
                        `${entry.variations} vs.`,
                        `${item.id}|${item.variation}`,
                        'WARN: normalizedId and variation collision',
                    ].join(' ')
                );
            }

            entry.data.push(data);
            entry.variations.push(data.variation);

            entry.entry = entry.entry || !!item.expose;
            entry.expose = entry.expose || item.expose;
            groupedByNorm.set(id, entry);

            // this will be used when we shorten internal module's id
            // to index
            Object.keys(data.deps).forEach((literal) => {
                const norm = data.deps[literal];
                if (!depToData.has(norm)) depToData.set(norm, []);
                depToData.get(norm).push({ deps: data.deps, literal });
            });
        });

        return Array.from(groupedByNorm.values()).map((entry, index) => {
            const internal = !entry.entry && !entry.expose;
            if (!internal) return entry;

            const norm = entry.id;
            entry.data.forEach((d) => (d.id = index));
            if (depToData.has(norm)) {
                depToData.get(norm).forEach(({ deps, literal }) => {
                    deps[literal] = index;
                });
            }
            return entry;
        });
    }
};
