const { test } = require('tap');
const EventEmitter = require('events');
const path = require('path');
const applyExtraOptions = require('../apply-extra-options');

function fakeB() {
    const b = new EventEmitter();
    b._pending = 0;
    b.ignored = [];
    b.excluded = [];
    b.externals = [];
    b.ignore = (f) => b.ignored.push(f);
    b.exclude = (f) => b.excluded.push(f);
    b.external = (f) => b.externals.push(f);
    b.ready = () =>
        new Promise((resolve, reject) => {
            if (b._pending === 0) return resolve();
            b.on('_ready', resolve);
            b.on('error', reject);
        });
    return b;
}

const fixtures = path.join(__dirname, 'fixtures/glob');

test('ignore pattern with no matches falls back to the pattern itself', (t) => {
    const b = fakeB();
    applyExtraOptions(b, { ignore: 'fixtures/glob/nothing/*.js' });
    return b.ready().then(() => {
        t.same(b.ignored, ['fixtures/glob/nothing/*.js']);
    });
});

test('ignore pattern expands to every matched file', (t) => {
    const b = fakeB();
    applyExtraOptions(b, { ignore: `${fixtures}/*.js` });
    return b.ready().then(() => {
        t.same(b.ignored.sort(), [
            path.join(fixtures, 'a.js'),
            path.join(fixtures, 'b.js'),
        ]);
    });
});

test('exclude keeps the pattern and expands to every matched file', (t) => {
    const b = fakeB();
    applyExtraOptions(b, { exclude: `${fixtures}/*.js` });
    return b.ready().then(() => {
        t.same(b.excluded.sort(), [
            `${fixtures}/*.js`,
            path.join(fixtures, 'a.js'),
            path.join(fixtures, 'b.js'),
        ]);
    });
});

test('external with wildcard keeps the pattern and adds every matched file', (t) => {
    const b = fakeB();
    applyExtraOptions(b, { external: `${fixtures}/*.js` });
    return b.ready().then(() => {
        t.same(b.externals.sort(), [
            `${fixtures}/*.js`,
            path.join(fixtures, 'a.js'),
            path.join(fixtures, 'b.js'),
        ]);
    });
});
