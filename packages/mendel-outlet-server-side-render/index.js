const fs = require('fs');
const mendelRequireTransform = require('./transform-require');
const path = require('path');
const ManifestOutlet = require('mendel-outlet-manifest');

module.exports = class ServerSideRenderOutlet extends ManifestOutlet {
    constructor(config, options) {
        options = Object.assign({ envify: true, uglify: false }, options, {
            runtime: 'main',
        });
        super(config, options);
        this.config = config;
        this.outletOptions = options;
    }

    perform({ entries, options }) {
        const filterFn =
            this.outletOptions.includeNodeModules || false
                ? () => true
                : ({ id }) => id.indexOf('/node_modules') <= 0;

        entries = new Map(entries.entries());
        Array.from(entries.keys()).forEach((key) => {
            const entry = entries.get(key);
            if (!entry) entries.delete(key);
            else if (!filterFn(entry)) entries.delete(key);
        });
        super.perform({ entries, options });
        const promises = Array.from(entries.values()).map((e) =>
            this.performFile(e, options)
        );
        return Promise.all(promises);
    }

    getDestination(entry) {
        const isSource = this.config.variationConfig.allDirs.some((dir) => {
            return entry.id.indexOf(dir) >= 0;
        });

        return path.join(
            this.config.baseConfig.outdir,
            this.outletOptions.dir,
            // In case id is out of the source dir, we put default
            // "variation" of base variation.
            // This can be quite confusing to the SSR
            isSource ? '' : this.config.baseConfig.dir,
            entry.id
        );
    }

    performFile(entry, options) {
        return new Promise((resolve, reject) => {
            const dest = this.getDestination(entry);
            const source = this.transformFile(entry, dest, options);
            this.saveFileToDisk(dest, source).then(resolve, reject);
        });
    }

    transformFile(entry, dest, config) {
        const { runtime = 'main' } = config.options;
        let { id, source, rawSource, map } = entry;

        if (this.outletOptions.sourcemap === true) {
            source += map;
        }

        // JSON is transformed by default in Mendel but
        // node has special way of evaluating JSON for SSR
        if (path.extname(id) === '.json') {
            source = rawSource;
        } else if (this.outletOptions.requireTransform === true) {
            try {
                source = mendelRequireTransform(dest, entry, (entry, mod) => {
                    if (!entry.deps[mod]) return mod;
                    return entry.deps[mod][runtime];
                });
            } catch (err) {
                throw new Error(
                    `Failed to transform requires in "${entry.id}": ${err.message}`,
                    { cause: err }
                );
            }
        }

        return source;
    }

    saveFileToDisk(dest, source) {
        return fs.promises.mkdir(path.dirname(dest), { recursive: true }).then(
            () =>
                new Promise((resolve, reject) => {
                    fs.writeFile(dest, source, 'utf-8', (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                })
        );
    }
};
