const EventEmitter = require('events').EventEmitter;
const mendelConfig = require('mendel-config').devConfig;
const CacheClient = require('../cache/client');
const MendelGenerators = require('./generators');
const MendelClientRegistry = require('../registry/client');
const Outlets = require('./outlets');
const DefaultShims = require('../default-shims/node-stdlib-browser');

class BaseMendelClient extends EventEmitter {
    constructor(options = {}) {
        super();
        this.debug = require('debug')('mendel:client:' + this.constructor.name);

        if (options.config === false) {
            this.config = options;
        } else {
            this.config = mendelConfig(
                Object.assign({ defaultShim: DefaultShims }, options)
            );
        }

        this._verbose =
            typeof options.verbose !== 'undefined'
                ? options.verbose
                : process.env.NODE_ENV === 'development' ||
                  typeof process.env.NODE_ENV === 'undefined';

        this.registry = new MendelClientRegistry(this.config);
        this.generators = new MendelGenerators(this.config, this.registry);
        this.outlets = new Outlets(this.config);
        this.synced = false;
        process.once('SIGINT', () => {
            this.exit();
            process.kill(process.pid, 'SIGINT');
        });
    }

    _setupClient() {
        this.client = new CacheClient(this.config, this.registry);
        this.client.on('error', (error) => {
            if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
                console.error(
                    [
                        '[Mendel] This action requires mendel',
                        'builder running as a separate process.\n',
                    ].join(' ')
                );
                process.exit(1);
            }
        });

        this.client.on(
            'sync',
            function () {
                clearTimeout(this.initSyncMessage);
                this.emit('ready');
                this.synced = true;
                this.onSync.apply(this, arguments);

                this.debug('synced');
            }.bind(this)
        );
        this.client.on(
            'unsync',
            function () {
                this.debug('file change detected...');
                this.emit('change');
                this.synced = false;
                this.onUnsync.apply(this, arguments);
            }.bind(this)
        );
    }

    run(callback = () => {}) {
        this._setupClient();

        // Print a message if it does not sync within a second.
        if (this._verbose) {
            this.initSyncMessage = setTimeout(() => {
                this.initSyncMessage = null;
                console.log(
                    [
                        '[Mendel] Recent builder (re)start detected,',
                        'compiling might take a moment...',
                        '\n         To avoid this message,',
                        'leave your builder always running',
                    ].join(' ')
                );
            }, 3000);
        }

        // This will come after the sync listener that generates and outlets
        this.once('done', () => {
            this.exit();
            callback.call(null);
        });
        this.once('error', (error) => {
            console.error('[Mendel SEVERE] Outlet error', error);
            this.exit();
            callback.call(null, error);
        });
        this.client.once('error', (error) => {
            this.exit();
            callback.call(null, error);
        });
        this.client.start();
        return this;
    }

    exit() {
        if (this.client) this.client.onExit();
    }

    // eslint-disable-next-line no-unused-vars
    onUnsync(entryId) {}

    onSync() {}

    /**
     * Two readiness checks on purpose. Do not collapse them back into one
     * generic "isSynced": each caller needs one of the two and the wrong one
     * is silently broken.
     *
     * canServeRequest() is loose: a build() call will get an answer now, which
     * may legitimately be an error bundle. Anything that goes through build()
     * wants this — waiting for a clean build instead makes a request hang for
     * as long as a source file stays broken.
     *
     * isRegistryComplete() is strict: every entry is present and correct, so
     * `registry`/`getEntry()`/`walk()` may be read directly. An errored entry
     * is dropped from the registry, but its normalizedId can still hold that
     * module's *variation* entries — a direct reader that trusts the loose
     * check walks right past the missing base file and silently gets a
     * different variation's code instead.
     */
    canServeRequest() {
        return this.synced;
    }

    isRegistryComplete() {
        return this.getSyncState() === 'synced';
    }

    getSyncState() {
        if (!this.client) return 'unsynced';
        return this.client.getSyncState();
    }
}

module.exports = BaseMendelClient;
