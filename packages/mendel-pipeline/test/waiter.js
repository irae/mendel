const tap = require('tap');
const { EventEmitter } = require('events');
const Waiter = require('../src/step/waiter');

class FakeCache extends EventEmitter {
    constructor(ids = []) {
        super();
        this._ids = ids.slice();
    }
    add(id) {
        this._ids.push(id);
    }
    remove(id) {
        this._ids = this._ids.filter((existing) => existing !== id);
        this.emit('entryRemoved', id);
    }
    error(id) {
        this.emit('entryErrored', { id });
    }
    hasEntry(id) {
        return this._ids.indexOf(id) >= 0;
    }
    size() {
        return this._ids.length;
    }
    entries() {
        return this._ids.map((id) => ({ id }));
    }
}

function collect(waiter) {
    const done = [];
    waiter.on('done', ({ entryId }) => done.push(entryId));
    return done;
}

/**
 * Unit: the barrier holds until every entry is either read or errored, and an
 * errored entry is never handed downstream — that is what keeps a client's
 * error record from being overwritten by a "done" for the same file.
 */
tap.test('errored entries are excluded from the released batch', (t) => {
    const cache = new FakeCache(['a', 'b', 'c']);
    const waiter = new Waiter({ cache });
    const done = collect(waiter);

    waiter.perform({ id: 'a' });
    t.same(done, [], 'nothing is released while entries are outstanding');

    cache.error('b');
    t.same(done, [], 'an error alone does not open the barrier');

    waiter.perform({ id: 'c' });
    t.same(done, ['a', 'c'], 'barrier opens without the errored entry');

    t.end();
});

/**
 * Unit regression: an entry can error downstream after it already cleared the
 * barrier. Counting it in both sets used to make the barrier release while a
 * freshly added entry was still unread.
 */
tap.test(
    'an entry erroring after it cleared the barrier is not double counted',
    (t) => {
        const cache = new FakeCache(['a', 'b']);
        const waiter = new Waiter({ cache });

        waiter.perform({ id: 'a' });
        waiter.perform({ id: 'b' });

        const done = collect(waiter);
        cache.add('c');
        cache.error('b');

        t.same(done, [], 'barrier stays shut while the new entry is unread');

        waiter.perform({ id: 'c' });
        t.same(done, ['a', 'c'], 'barrier opens once the new entry is read');

        t.end();
    }
);

/**
 * Unit regression: errors raised by downstream steps re-enter the barrier check
 * while it is releasing. That must terminate rather than recurse unboundedly.
 */
tap.test('repeated error signals terminate instead of recursing', (t) => {
    const cache = new FakeCache(['a', 'b', 'c']);
    const waiter = new Waiter({ cache });

    let releases = 0;
    waiter.on('done', ({ entryId }) => {
        releases++;
        // Emulate a graph transform failing synchronously as it receives an
        // entry, which is how the recursion used to start.
        if (releases < 50) cache.error(entryId);
    });

    ['a', 'b', 'c'].forEach((id) => waiter.perform({ id }));

    t.ok(releases > 0, 'the barrier did release');
    t.ok(releases < 50, 'releases are bounded by the number of entries');

    t.end();
});

/**
 * Unit: removing an entry (what a file change does) must forget both its read
 * and its errored state so the fixed file blocks the barrier again.
 */
tap.test('removing an entry clears its errored state', (t) => {
    const cache = new FakeCache(['a', 'b']);
    const waiter = new Waiter({ cache });

    waiter.perform({ id: 'a' });
    cache.error('b');

    const done = collect(waiter);
    cache.remove('b');
    cache.add('b');
    t.same(done, [], 'a re-added entry blocks the barrier again');

    waiter.perform({ id: 'b' });
    t.same(done, ['a', 'b'], 'both entries are released once the fix is read');

    t.end();
});

/**
 * Unit: an error for an id the cache no longer holds must not resurrect it in
 * the accounting.
 */
tap.test('errors for unknown entries are ignored', (t) => {
    const cache = new FakeCache(['a']);
    const waiter = new Waiter({ cache });
    const done = collect(waiter);

    cache.error('gone');
    t.same(done, [], 'an unknown id does not open the barrier');

    waiter.perform({ id: 'a' });
    t.same(done, ['a'], 'only real entries are released');

    t.end();
});
