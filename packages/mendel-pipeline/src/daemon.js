const debug = require('debug')('mendel:daemon');
const path = require('path');
const mendelConfig = require('mendel-config');

const EventEmitter = require('events').EventEmitter;
const MendelCache = require('./cache');
const Watcher = require('./fs-watcher');
const Transformer = require('./transformer');
const DepResolver = require('./deps');

const MendelPipeline = require('./pipeline');
const CacheServer = require('./cache/server');
const DefaultShims = require('node-libs-browser');

process.title = 'Mendel Daemon';

class CacheManager extends EventEmitter {
    constructor() {
        super();
        this._caches = new Map();
        this._watchedFileId = new Set();
    }

    addCache(cache) {
        const env = cache.environment;
        this._caches.set(env, cache);
        cache.on('entryRequested', (path) => this.emit('entryRequested', path));
        cache.on('doneEntry', (ent) => this.emit('doneEntry', cache, ent));
        cache.on('entryRemoved', (ent) =>
            this.emit('entryRemoved', cache, ent)
        );
        cache.on('entryChanged', (ent) =>
            this.emit('entryRemoved', cache, ent)
        );
        cache.on('entryErrored', (des) =>
            this.emit('entryErrored', cache, des)
        );
    }

    /**
     * Sync is called after pipeline is initialized with event handlers and steps
     */
    sync(to) {
        const caches = Array.from(this._caches.values()).filter(
            (cache) => cache !== to
        );
        Array.from(this._watchedFileId.keys()).forEach((id) => {
            const from = caches.find((cache) => cache.hasEntry(id));
            // TODO clean up and remove entry everywhere if no cache has this entry
            if (!from) return;

            const entry = from.getEntry(id);
            to.addEntry(id);
            to.getEntry(id).setSource(
                entry.rawSource,
                entry.rawDeps,
                entry.map
            );
        });
    }

    getCache(env) {
        return this._caches.get(env);
    }

    addEntry(id) {
        this._watchedFileId.add(id);
        Array.from(this._caches.values()).forEach((cache) =>
            cache.addEntry(id)
        );
    }

    hasEntry(id) {
        return Array.from(this._caches.values()).some((cache) =>
            cache.hasEntry(id)
        );
    }

    removeEntry(id) {
        this._watchedFileId.delete(id);
        Array.from(this._caches.values()).forEach((cache) =>
            cache.removeEntry(id)
        );
    }
}

module.exports = class MendelPipelineDaemon extends EventEmitter {
    constructor(options) {
        super();
        const defaultShim = Object.assign(
            {
                global: path.join(__dirname, 'default-shims', 'global.js'),
            },
            DefaultShims
        );
        options = Object.assign({ defaultShim }, options);

        const config = mendelConfig(options);
        this.config = config;

        this.cacheManager = new CacheManager();
        this.transformer = new Transformer(config);
        // Dependency resolver consults with cache
        this.depsResolver = new DepResolver(config, this.cacheManager);

        this.server = new CacheServer(config, this.cacheManager);
        this.watcher = new Watcher(config, this.cacheManager);

        // Create environments
        this.environments = {};
        this.pipelines = {};
        this.default = config.environment;
        this.environments[config.environment] = config;
        Object.keys(config.env)
            .concat('development')
            .forEach((environment) => {
                if (!Object.hasOwn(this.environments, environment)) {
                    const envConf = mendelConfig(
                        Object.assign({}, options, { environment })
                    );
                    this.environments[environment] = envConf;
                }
            });

        this.server.on('environmentRequested', (env) => this._watch(env));
        this.server.once('ready', () => this.emit('ready'));
        this.server.once('error', () => setImmediate(() => process.exit(1)));
        this.watcher.subscribe(
            [config.variationConfig.allDirs, config.support].filter(Boolean)
        );
    }

    _watch(environment) {
        // this prioritizes the default env first
        return this.getPipeline(environment);
    }

    watch(environment = this.default) {
        const currentPipeline = this._watch(environment);

        // To optimize development flow, if `environment=development` and
        // we are done processing, start other bundles, except production to
        // speed up when other evns are requested (e.g. unit tests)
        if (environment === 'development' && Boolean(process.env.MENDEL_BETA)) {
            this.watchNextEnv(currentPipeline);
        }

        process.once('SIGINT', () => process.exit(0));
        process.once('SIGTERM', () => process.exit(0));
        // Above `process.exit()` results in `exit` event.
        process.once('exit', () => this.onExit());
        process.once('uncaughtException', (error) => {
            console.error('[Mendel] Force closing due to a critical error:');
            console.error(error.stack);
            this.onForceExit();
        });
    }

    watchNextEnv(lastPipeline) {
        lastPipeline.once('idle', () => {
            setTimeout(() => {
                const nextEnv = Object.keys(this.environments)
                    .filter((env) => {
                        // ony envs we din't process yet
                        return !this.pipelines[env];
                    })
                    .sort((a, b) => {
                        // production last
                        if (a === 'production') {
                            return 1;
                        }
                        if (b === 'production') {
                            return -1;
                        }
                        return 0;
                    })
                    .shift();

                if (nextEnv === 'production') {
                    // TODO: Figure out production problems, likelly related to
                    //       deps being different and cache not creating a perfect
                    //       sandbox
                    return;
                }

                this.watchNextEnv(this._watch(nextEnv));
            }, 5 * 1000);
        });
    }

    run(callback, environment = this.default) {
        // Undo default exit handler
        this.server.removeAllListeners('error');
        this.server.once('error', callback);
        const pipeline = this.getPipeline(environment);

        // In case of non-watch mode, nothing is recoverable. Exit.
        this.cacheManager.once('entryErrored', () => process.exit(1));
        pipeline.on('idle', () => {
            if (this.server.isReady()) callback();
            else this.server.once('ready', callback);
        });
    }

    getPipeline(environment = this.default) {
        if (!this.pipelines[environment]) {
            debug(`Initializing for environment: ${environment}`);
            const envConf = this.environments[environment];
            // Missing configuration for an environment. Ignore.
            if (!envConf) {
                throw new Error(
                    `[Mendel] Client is expecting an environemnt "${environment}" but it is missing from the configuration.`
                ); // eslint-disable-line max-len
            }
            const cache = new MendelCache(envConf);

            this.cacheManager.addCache(cache);
            this.pipelines[environment] = new MendelPipeline({
                cache,
                transformer: this.transformer,
                depsResolver: this.depsResolver,
                options: envConf,
            });

            this.pipelines[environment].once('idle', () => {
                // Without printing this out, it is super hard to know when
                // you are ready to start a client process
                debug(`[Mendel] ready for environment: ${environment}`);
            });

            this.cacheManager.sync(cache);
            this.pipelines[environment].watch();

            // `config.support` is a special configuration
            // that can dynamically add more entries to the pipeline.
            if (envConf.support) {
                this.watcher.subscribe([envConf.support]);
            }
        }
        return this.pipelines[environment];
    }

    // For graceful exit
    onExit() {
        debug('Exiting gracefully. Cleaning up.');
        [
            this.cacheManager,
            this.transformer,
            this.depsResolver,
            this.server,
            this.watcher,
        ]
            .filter((tool) => tool.onExit)
            .forEach((tool) => tool.onExit());
    }

    onForceExit() {
        debug('Instructed to force exit');
        [
            this.cacheManager,
            this.transformer,
            this.depsResolver,
            this.server,
            this.watcher,
        ]
            .filter((tool) => tool.onForceExit)
            .forEach((tool) => tool.onForceExit());
    }
};
