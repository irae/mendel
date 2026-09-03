/* Copyright 2015-2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

const network = require('./network');
const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('mendel:net:client');
const error = require('debug')('mendel:net:client:error');
const verbose = require('debug')('verbose:mendel:net:client');
const util = require('node:util');
const debugFilter = require('mendel-development/debug-filter');

class CacheClient extends EventEmitter {
    constructor({ cacheConnection, environment }, registry) {
        super();

        this.registry = registry;
        this.environment = environment;

        this.cacheConnection = cacheConnection;
        this.connected = false;
        this.synced = false;
        this.closeReqeusted = false;
        this.erroredEntries = new Map();
        this.connect();
    }

    start() {
        if (this.connected) this.bootstrapConnection();
        else this.connection.once('connect', () => this.bootstrapConnection());
    }

    onExit() {
        this.closeReqeusted = true;
        this.connection.end();
    }

    onForceExit() {
        this.closeReqeusted = true;
        this.connection.end();
    }

    connect(isRetry = false) {
        verbose('connecting with params', this.cacheConnection);
        const conn = network.getClient(this.cacheConnection);
        this.connection = conn;
        conn.on('error', (err) => !isRetry && this.emit('error', err));
        conn.on('data', (data) => {
            try {
                data = JSON.parse(data);
            } catch (e) {
                error(e);
            }
            if (!data || !data.type) return;

            switch (data.type) {
                case 'addEntry': {
                    debugFilter(verbose, 'got ' + data.entry.id);

                    this.registry.addEntry(data.entry);
                    this.erroredEntries.delete(data.entry.id);

                    if (typeof data.totalEntries === 'number') {
                        this.checkStatus(data.totalEntries);
                    }
                    break;
                }
                case 'removeEntry': {
                    const unsynced = this.synced ? true : false;
                    this.synced = false;
                    this.registry.removeEntry(data.id);
                    this.erroredEntries.delete(data.id);
                    if (unsynced) this.emit('unsync', data.id);

                    // Only a "final" removal (a real fs unlink, never
                    // followed by an addEntry) is safe to re-check status
                    // for here. A file being rebuilt also goes through
                    // removeEntry, and resyncing before its addEntry lands
                    // would let a request through against a bundle that's
                    // still missing that entry.
                    if (data.final && typeof data.totalEntries === 'number') {
                        this.checkStatus(data.totalEntries);
                    }
                    break;
                }
                case 'errorEntry': {
                    const unsynced = this.synced ? true : false;
                    this.synced = false;
                    this.registry.removeEntry(data.id);
                    this.erroredEntries.set(data.id, {
                        id: data.id,
                        environment: this.environment,
                        message: data.error?.message || 'Unknown error',
                        stack: data.error?.stack || '',
                    });
                    if (unsynced) this.emit('unsync', data.id);

                    console.error(
                        util.styleText(
                            ['red'],
                            `[Mendel] Errored while parsing ${data.id}\n`
                        ),
                        data.error?.stack ||
                            data.error?.message ||
                            'Unknown error'
                    );

                    // The server excludes errored entries from totalEntries, so
                    // this is what lets an environment reach synced-with-errors
                    // instead of waiting forever for an entry that never lands.
                    if (typeof data.totalEntries === 'number') {
                        this.checkStatus(data.totalEntries);
                    }
                    break;
                }
                default:
                    break;
            }
        });

        conn.on('connect', () => {
            verbose('connected');
            this.connected = true;
            if (isRetry) {
                debug('Reconnected to daemon. Good to go!');
            }
        });

        conn.on('close', () => {
            if (!isRetry) this.emit('unsync');
            this.registry.clear();
            this.erroredEntries.clear();
            this.synced = false;

            debug('Disconnected from master');
            // User intentionally closed. Do not print or retry to connect
            if (this.closeReqeusted) return;

            if (!isRetry) {
                debug(
                    [
                        'Daemon has disconnected.',
                        'Will try to reconnect...',
                    ].join(' ')
                );
            }

            setTimeout(() => {
                this.connect(true);
                this.start();
            }, 5000);
        });
    }

    bootstrapConnection() {
        // Request for all entries for warming the cache.
        this.connection.send({
            type: 'bootstrap',
            environment: this.environment,
        });
    }

    checkStatus(total) {
        if (this.registry.size === total && !this.synced) {
            debug(`${this.registry.size} entries are synced with a server`);
            this.synced = true;
            this.emit('sync');
        }
    }

    /**
     * @returns {'unsynced'|'synced'|'synced-with-errors'} "synced-with-errors"
     *   means every entry the builder can still deliver has arrived, so bundle
     *   requests must be answered — with an error bundle, not a truncated one.
     */
    getSyncState() {
        if (!this.synced) return 'unsynced';
        return this.hasErrors() ? 'synced-with-errors' : 'synced';
    }

    // Error state is per environment, not per bundle, by design: any error breaks
    // every bundle including CSS, the way a broken production build renders
    // nothing at all. Scoping it (and the "serve last-known-good CSS" variant)
    // was considered and rejected — see
    // docs/superpowers/handoff/error-bundle-scope-analysis.md.
    hasErrors() {
        return this.erroredEntries.size > 0;
    }

    getErrors() {
        return Array.from(this.erroredEntries.values());
    }
}

module.exports = CacheClient;
