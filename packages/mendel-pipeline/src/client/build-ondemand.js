const BaseClient = require('./base-client');
const Stream = require('stream');
const Bundle = require('../bundles/bundle');
const ErrorBundleGenerator = require('../bundles/error-bundle');

class BuildOnDemand extends BaseClient {
    constructor(options) {
        super(options);

        this._bundles = null;
        this._bundleCache = new Map();
        this._requests = [];
        this._errorBundleCache = new Map();
    }

    getCacheKey(bundleId, variations) {
        return `${bundleId}-${variations.join(':')}`;
    }

    build(bundleId, variations, { type = 'js' } = {}) {
        const bundle = this.config.bundles.find(({ id }) => id === bundleId);
        if (!bundle) {
            throw new Error(
                `Could not find any bundle id ${bundleId} from mendelrc`
            );
        }

        const key = this.getCacheKey(bundleId, variations);
        if (!this.client.hasErrors() && this._bundleCache.has(key)) {
            return Promise.resolve(this._bundleCache.get(key));
        }

        return new Promise((resolve, reject) => {
            const request = {
                id: bundleId,
                variations,
                type,
                promise: { resolve, reject },
            };
            this._requests.push(request);
            if (this.synced) this._perform();
        });
    }

    isSynced() {
        return this.synced;
    }

    getSyncState() {
        return this.client.getSyncState();
    }

    _perform() {
        if (this.client.hasErrors()) {
            const errors = this.client.getErrors();
            this._requests.forEach(({ id, variations, type, promise }) => {
                const key = `${this.getCacheKey(id, variations)}-${type}`;
                if (!this._errorBundleCache.has(key)) {
                    this._errorBundleCache.set(
                        key,
                        ErrorBundleGenerator.generate(errors, {
                            type,
                            environment: this.config.environment,
                        })
                    );
                }
                promise.resolve(this._errorBundleCache.get(key));
            });
            this._requests = [];
            return;
        }

        if (!this._bundles) {
            try {
                this._bundles = this.generators.performAll(
                    this.config.bundles.map((opts) => new Bundle(opts))
                );
            } catch (e) {
                // Generators run synchronously off the "sync" event; letting
                // this escape takes the whole host process down.
                this._bundles = null;
                console.error('[Mendel] Bundle generation failed');
                console.error(e.stack);
                this._requests.forEach(({ promise }) => promise.reject(e));
                this._requests = [];
                return;
            }
        }

        this._requests.forEach(({ id, variations, promise }) => {
            const bundle = this._bundles.find((b) => b.id === id);
            Promise.resolve()
                .then(() => this.outlets.perform([bundle], variations))
                .then(([output]) => {
                    const key = this.getCacheKey(bundle.id, variations);
                    if (output instanceof Stream) {
                        let data = '';
                        output.on('data', (d) => (data += d.toString()));
                        output.on('end', () => {
                            this._bundleCache.set(key, data);
                        });
                    } else {
                        this._bundleCache.set(key, output);
                    }
                    promise.resolve(output);
                })
                .catch((e) => {
                    promise.reject(e);
                });
        });
        this._requests = [];
    }

    onSync() {
        this._perform();
    }

    onUnsync() {
        this._bundles = null;
        this._bundleCache.clear();
        this._errorBundleCache.clear();
    }
}

module.exports = BuildOnDemand;
