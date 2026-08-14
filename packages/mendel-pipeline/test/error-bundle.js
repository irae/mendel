const tap = require('tap');
const ErrorBundleGenerator = require('../src/bundles/error-bundle');
const CacheServer = require('../src/cache/server');

const JSX_ERROR = {
    id: './app/broken.js',
    environment: 'development',
    message: 'Unexpected token: <Button prop="a & b" />',
    stack: 'SyntaxError: bad\n  at ./app/broken.js:3:1 /* inside */ done',
};

/**
 * Unit: the browser has to end up looking at the error, not at a half-rendered
 * app, and the error text must survive being embedded in a page.
 */
tap.test('javascript error bundle takes the page over', (t) => {
    const bundle = ErrorBundleGenerator.generate([JSX_ERROR], {
        type: 'js',
        environment: 'development',
    });

    t.match(bundle, /\[Mendel Build Error\]/, 'logs a marker to the console');
    t.match(bundle, /console\.error/, 'reports details to the console');
    t.match(
        bundle,
        /document\.open\(\);[\s\S]*document\.write\([\s\S]*document\.close\(\)/,
        'replaces the whole document instead of patching innerHTML'
    );
    t.match(bundle, /<!DOCTYPE html>/, 'writes a full document');
    t.match(bundle, /broken\.js/, 'names the file');
    t.match(bundle, /development/, 'names the environment');
    t.match(bundle, /SyntaxError: bad/, 'carries the stack');

    t.end();
});

/**
 * Unit: error messages routinely quote source (JSX, quotes, ampersands), which
 * must not be able to inject markup into the overlay.
 */
tap.test('error text is escaped before it reaches the page markup', (t) => {
    const page = ErrorBundleGenerator.generateErrorPage(
        [JSX_ERROR],
        'development'
    );

    t.notMatch(page, /<Button/, 'markup in the message is escaped');
    t.match(page, /&lt;Button/, 'the message is still readable, escaped');
    t.match(page, /a &amp; b/, 'ampersands are escaped');

    t.end();
});

/**
 * Unit: a stylesheet request gets a stylesheet. A stack trace containing "*∕"
 * must not be able to close the comment and leak garbage declarations.
 */
tap.test('css error bundle stays inside one comment', (t) => {
    const bundle = ErrorBundleGenerator.generate([JSX_ERROR], {
        type: 'css',
        environment: 'development',
    });

    t.match(bundle, /^\/\* \[Mendel\] Build Error/, 'is a css comment');
    t.match(bundle, /broken\.js/, 'names the file');
    t.match(bundle, /development/, 'names the environment');
    t.equal(
        bundle.indexOf('*/'),
        bundle.length - 2,
        'the only comment terminator is the closing one'
    );

    t.end();
});

/**
 * Unit: content negotiation is the caller's decision; there is no bundle
 * property that says whether a request wanted css.
 */
tap.test('bundle flavour follows the requested type', (t) => {
    const js = ErrorBundleGenerator.generate([JSX_ERROR], { type: 'js' });
    const css = ErrorBundleGenerator.generate([JSX_ERROR], { type: 'css' });
    const fallback = ErrorBundleGenerator.generate([JSX_ERROR]);

    t.type(js, 'string', 'js bundles are strings, not streams');
    t.type(css, 'string', 'css bundles are strings, not streams');
    t.not(js, css, 'the two flavours differ');
    t.equal(fallback, js, 'javascript is the default');

    t.end();
});

/**
 * Unit regression: Error instances serialize to "{}" through JSON, which used
 * to reach clients as an error with no message and no stack.
 */
tap.test('errors keep message and stack when signalled to a client', (t) => {
    const sent = [];
    const server = Object.create(CacheServer.prototype);
    server.send = (client, data) => sent.push(data);

    const error = new Error('Errored while transforming ./app/broken.js');
    server._signalError(
        {},
        { deliverableSize: () => 7 },
        { id: './app/broken.js', error }
    );

    t.equal(sent.length, 1, 'one message is sent');
    const [payload] = sent;
    const roundTripped = JSON.parse(JSON.stringify(payload));

    t.equal(roundTripped.type, 'errorEntry', 'is an error signal');
    t.equal(roundTripped.id, './app/broken.js', 'names the entry');
    t.equal(
        roundTripped.error.message,
        error.message,
        'message survives serialization'
    );
    t.equal(
        roundTripped.error.stack,
        error.stack,
        'stack survives serialization'
    );
    t.equal(
        roundTripped.totalEntries,
        7,
        'client is told how many entries it can still expect'
    );

    t.end();
});
