/* Copyright 2015-2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

const network = require('./network');
const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('mendel:net:server');
const error = require('debug')('mendel:net:server:error');
const verbose = require('debug')('verbose:mendel:net:server');
const debugFilter = require('mendel-development/debug-filter');

class CacheServer extends EventEmitter {
    constructor(config, cacheManager) {
        super();

        this.config = config;
        this._types = config.types;

        this.clients = [];

        this.cacheManager = cacheManager;
        this.initCache();

        network
            .getServer(config.cacheConnection)
            .then((server) => {
                this.server = server;
                this.initServer();

                debug('listening', config.cacheConnection);
                this.emit('ready');
            })
            .catch((err) => {
                this.emit('error', err);
                debug('Cache server could not come up', err);
            });
    }

    isReady() {
        return !!this.server;
    }

    onExit() {
        if (this.server) this.server.close();
    }

    onForceExit() {
        if (this.server) this.server.close();
    }

    send(client, data) {
        if (client.destroyed) return;
        try {
            client.send(data);
        } catch (e) {
            console.error('[Mendel] builder communication error');
            console.error(e.stack);
        }
    }

    initServer() {
        this.server.on('error', (e) => {
            console.error('[Mendel] builder errored');
            console.error(e.stack);
            process.exit(1);
        });
        this.server.on('listening', () => this.emit('ready'));

        this.server.on('connection', (client) => {
            debug(`[${this.clients.length}] A client connected`);
            this.clients.push(client);
            client.on('close', () => {
                this.clients.splice(this.clients.indexOf(client), 1);
                debug(`[${this.clients.length}] A client disconnected`);
            });
            client.on('error', () => {});

            client.on('data', (data) => {
                try {
                    data = typeof data === 'object' ? data : JSON.parse(data);
                } catch (e) {
                    error(e);
                }
                if (!data || !data.type) return;

                switch (data.type) {
                    case 'bootstrap': {
                        this.emit('environmentRequested', data.environment);
                        client.environment = data.environment;
                        this.bootstrap(client);
                        break;
                    }
                    default:
                        return;
                }
                this.send(client, data);
            });
        });
    }

    initCache() {
        this.cacheManager.on('doneEntry', (cache, entry) => {
            this.clients
                .filter((c) => c.environment === cache.environment)
                .forEach((c) => this._sendEntry(c, cache, entry));
        });
        this.cacheManager.on('entryRemoved', (cache, entryId, meta) => {
            this.clients
                .filter((client) => client.environment === cache.environment)
                .forEach((client) =>
                    this._signalRemoval(client, cache, entryId, meta)
                );
        });
        this.cacheManager.on('entryErrored', (cache, desc) => {
            this.clients
                .filter((client) => client.environment === cache.environment)
                .forEach((client) => this._signalError(client, cache, desc));
        });
    }

    // Errors go out before the done entries: the last done entry is what makes
    // a client reach "synced", and it must already know about the errors then.
    bootstrap(client) {
        const cache = this.cacheManager.getCache(client.environment);
        cache
            .entries()
            .filter((entry) => entry.error)
            .forEach((entry) =>
                this._signalError(client, cache, {
                    id: entry.id,
                    error: entry.error,
                })
            );
        cache
            .entries()
            .filter((entry) => entry.done)
            .forEach((entry) => this._sendEntry(client, cache, entry));
    }

    serializeEntry(entry) {
        const {
            deps,
            source,
            map,
            type,
            runtime,
            rawSource,
            id,
            normalizedId,
        } = entry;

        let variation = this.getVariationForEntry(entry);
        if (!variation) {
            variation = this.config.variationConfig.baseVariation;
        }
        variation = variation.chain[0];

        return {
            id,
            normalizedId,
            // Metadata
            variation,
            type,
            runtime,
            // Dependency information
            // FIXME currently only puts dependencies in browser runtime
            deps,
            // Important source data
            source,
            map,
            rawSource,
        };
    }

    getVariationForEntry(entry) {
        const variations = this.config.variationConfig.variations;
        return variations.find(({ id }) => id === entry.variation);
    }

    _sendEntry(client, cache, entry) {
        this.send(client, {
            totalEntries: cache.deliverableSize(),
            type: 'addEntry',
            entry: this.serializeEntry(entry),
        });
        debugFilter(verbose, 'sent ' + entry.id);
    }

    // "final" tells a client this id is gone for good (a real fs unlink), as
    // opposed to the remove+add pair a file edit produces, so only a final
    // removal is safe for the client to resync its status against.
    _signalRemoval(client, cache, id, meta = {}) {
        this.send(client, {
            totalEntries: cache.deliverableSize(),
            type: 'removeEntry',
            final: !!meta.final,
            id,
        });
    }

    // Error instances stringify to "{}", so the fields have to be picked out.
    _signalError(client, cache, { id, error }) {
        this.send(client, {
            totalEntries: cache.deliverableSize(),
            error: {
                message: error.message,
                stack: error.stack,
            },
            type: 'errorEntry',
            id,
        });
    }
}

module.exports = CacheServer;
