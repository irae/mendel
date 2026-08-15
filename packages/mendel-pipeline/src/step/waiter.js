const BaseStep = require('./step');

class Waiter extends BaseStep {
    /**
     * @param {MendelCache} toolset.cache
     */
    constructor({ cache }) {
        super();
        this.waited = new Set();
        this.errored = new Set();
        this.cache = cache;
        this._releasing = false;
        this._recheck = false;

        cache.on('entryRemoved', (id, { final = false } = {}) => {
            this.waited.delete(id);
            this.errored.delete(id);
            if (final) this._checkCompletion();
        });

        cache.on('entryErrored', ({ id }) => {
            if (this.errored.has(id) || !this.cache.hasEntry(id)) return;
            this.waited.delete(id);
            this.errored.add(id);
            this._checkCompletion();
        });
    }

    perform(entry) {
        this.errored.delete(entry.id);
        this.waited.add(entry.id);
        this.emit('wait', { entryId: entry.id });
        this._checkCompletion();
    }

    // Downstream steps can error an entry synchronously while the barrier is
    // being released, which re-enters here. Loop instead of recursing; each
    // re-entry needs a fresh entry or a not-yet-errored id, so it terminates.
    _checkCompletion() {
        if (this._releasing) {
            this._recheck = true;
            return;
        }
        this._releasing = true;
        try {
            do {
                this._recheck = false;
                const ready = this.waited.size + this.errored.size;
                if (this.cache.size() > ready) break;
                this.cache
                    .entries()
                    .filter(({ id }) => !this.errored.has(id))
                    .forEach(({ id }) => this.emit('done', { entryId: id }));
            } while (this._recheck);
        } finally {
            this._releasing = false;
        }
    }
}

module.exports = Waiter;
