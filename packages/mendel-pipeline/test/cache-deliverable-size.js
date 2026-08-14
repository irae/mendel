const tap = require('tap');
const MendelCache = require('../src/cache');

function makeCache({ environment = 'development', ignores = [] } = {}) {
    return new MendelCache({
        projectRoot: '/tmp/mendel-deliverable-size',
        environment,
        baseConfig: { id: 'base', dir: './app' },
        variationConfig: { variations: [] },
        shim: {},
        types: [],
        ignores,
    });
}

// The pre-optimization definition, recomputed independently of the cache's
// own bookkeeping so a drifting counter cannot hide behind it.
function bruteForceDeliverable(cache) {
    return cache.entries().filter((entry) => !entry.error);
}

function assertAgrees(t, cache, label) {
    const expected = bruteForceDeliverable(cache);
    t.same(
        cache.deliverableEntries().map(({ id }) => id),
        expected.map(({ id }) => id),
        `${label}: deliverableEntries matches a full scan`
    );
    t.equal(
        cache.deliverableSize(),
        expected.length,
        `${label}: deliverableSize matches a full scan`
    );
}

/**
 * Unit: every mutation that can change an entry's error state keeps
 * `deliverableSize` equal to a full scan of the cache, checked after each
 * individual step rather than only at the end.
 */
tap.test('deliverable counts agree with a full scan at every step', (t) => {
    const cache = makeCache();

    assertAgrees(t, cache, 'empty cache');

    ['./a.js', './b.js', './c.js', './d.js'].forEach((id) => {
        cache.addEntry(id);
        assertAgrees(t, cache, `after adding ${id}`);
    });

    cache.addEntry('./a.js');
    assertAgrees(t, cache, 'after re-adding an existing entry');

    cache.setEntryError('./a.js', new Error('boom'));
    assertAgrees(t, cache, 'after erroring a.js');

    cache.setEntryError('./b.js', new Error('boom'));
    assertAgrees(t, cache, 'after erroring b.js');

    cache.setEntryError('./a.js', new Error('boom again'));
    assertAgrees(t, cache, 'after erroring a.js a second time');

    cache.setEntryError('./missing.js', new Error('boom'));
    assertAgrees(t, cache, 'after erroring an unknown entry');

    cache.setEntryError('./a.js', null);
    assertAgrees(t, cache, 'after clearing a.js error');

    cache.setEntryError('./a.js', null);
    assertAgrees(t, cache, 'after clearing an already clear error');

    cache.setEntryError('./a.js', new Error('boom once more'));
    assertAgrees(t, cache, 'after erroring a.js again post-recovery');

    cache.removeEntry('./a.js');
    assertAgrees(t, cache, 'after removing an errored entry');

    cache.removeEntry('./a.js');
    assertAgrees(t, cache, 'after removing an already removed entry');

    cache.removeEntry('./c.js');
    assertAgrees(t, cache, 'after removing a healthy entry');

    // A watched file that changes is removed and re-added; the fresh entry
    // must come back deliverable even though the removed one had errored.
    cache.removeEntry('./b.js');
    assertAgrees(t, cache, 'after removing the second errored entry');
    cache.addEntry('./b.js');
    assertAgrees(t, cache, 'after re-adding a previously errored entry');

    cache.setEntryError('./b.js', new Error('boom'));
    cache.setEntryError('./d.js', new Error('boom'));
    assertAgrees(t, cache, 'after erroring every remaining entry');
    t.equal(cache.deliverableSize(), 0, 'an all-errored cache delivers none');

    cache.removeEntry('./b.js', { final: true });
    cache.removeEntry('./d.js', { final: true });
    assertAgrees(t, cache, 'after draining the cache');
    t.equal(cache.size(), 0, 'cache is empty');

    t.end();
});

/**
 * Unit: a fully errored cache never reports a negative deliverable count, the
 * failure mode a double-decrementing counter would produce.
 */
tap.test('deliverable size never goes negative', (t) => {
    const cache = makeCache();

    cache.addEntry('./a.js');
    cache.setEntryError('./a.js', new Error('boom'));
    cache.setEntryError('./a.js', new Error('boom'));
    cache.removeEntry('./a.js');
    cache.addEntry('./a.js');

    t.equal(
        cache.deliverableSize(),
        1,
        'recreated entry counts as deliverable'
    );
    assertAgrees(t, cache, 'after error-remove-readd');

    t.end();
});

/**
 * Unit: a step can error an entry that the watcher already deleted, since
 * both arrive asynchronously. The stale signal must not be counted against
 * a cache that no longer holds the entry.
 */
tap.test('an error arriving after a delete does not skew the count', (t) => {
    const cache = makeCache();

    cache.addEntry('./a.js');
    cache.addEntry('./b.js');
    cache.setEntryError('./a.js', new Error('boom'));
    cache.removeEntry('./a.js', { final: true });
    assertAgrees(t, cache, 'after a final removal of an errored entry');

    cache.setEntryError('./a.js', new Error('late boom'));
    assertAgrees(t, cache, 'after a late error for the removed entry');

    cache.addEntry('./a.js');
    assertAgrees(t, cache, 'after the id comes back');
    t.equal(cache.deliverableSize(), 2, 'both live entries are deliverable');

    t.end();
});

/**
 * Unit: ignored paths never enter the store, so neither an add nor a later
 * error signal for them can move the count.
 */
tap.test('ignored files never move the count', (t) => {
    const cache = makeCache({ ignores: ['*.ignored.js'] });

    cache.addEntry('./a.js');
    cache.addEntry('./skip.ignored.js');
    assertAgrees(t, cache, 'after adding an ignored file');
    t.equal(cache.deliverableSize(), 1, 'only the watched file counts');

    cache.setEntryError('./skip.ignored.js', new Error('boom'));
    assertAgrees(t, cache, 'after erroring an ignored file');
    t.equal(cache.deliverableSize(), 1, 'the ignored file is still uncounted');

    t.end();
});

/**
 * Unit: the daemon fans every add and remove out to one cache per
 * environment. Each cache must account only for its own entries, including
 * when an entry errors in one environment but not another.
 */
tap.test('each environment cache counts independently', (t) => {
    const dev = makeCache({ environment: 'development' });
    const prod = makeCache({ environment: 'production' });
    const fanOut = (method, ...args) =>
        [dev, prod].forEach((cache) => cache[method](...args));

    fanOut('addEntry', './a.js');
    fanOut('addEntry', './b.js');

    dev.setEntryError('./a.js', new Error('boom'));
    assertAgrees(t, dev, 'dev after its own error');
    assertAgrees(t, prod, 'prod unaffected by a dev error');
    t.equal(dev.deliverableSize(), 1, 'dev drops the errored entry');
    t.equal(prod.deliverableSize(), 2, 'prod still delivers both');

    fanOut('removeEntry', './a.js', { final: true });
    assertAgrees(t, dev, 'dev after the shared removal');
    assertAgrees(t, prod, 'prod after the shared removal');

    // An id one environment never held must not decrement that environment.
    prod.addEntry('./prod-only.js');
    prod.setEntryError('./prod-only.js', new Error('boom'));
    fanOut('removeEntry', './prod-only.js');
    assertAgrees(t, dev, 'dev after removing an id it never had');
    assertAgrees(t, prod, 'prod after removing its own errored entry');
    t.equal(dev.deliverableSize(), 1, 'dev keeps its single healthy entry');
    t.equal(prod.deliverableSize(), 1, 'prod keeps its single healthy entry');

    t.end();
});
