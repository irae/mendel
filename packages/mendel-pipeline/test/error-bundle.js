const tap = require('tap');
const { codeFrameColumns } = require('@babel/code-frame');
const ErrorBundleGenerator = require('../src/bundles/error-bundle');
const CacheServer = require('../src/cache/server');

const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[`);

const BROKEN_SOURCE = [
    "import React from 'react';",
    '',
    'export default function Broken() {',
    '    return <div>;',
    '}',
].join('\n');

function coloredFrameError() {
    const frame = codeFrameColumns(
        BROKEN_SOURCE,
        { start: { line: 4, column: 17 } },
        { highlightCode: true, forceColor: true }
    );
    const message = `./app/broken.js: Unexpected token (4:17)\n\n${frame}`;

    return {
        id: './app/broken.js',
        environment: 'development',
        message,
        stack: `SyntaxError: ${message}\n    at Parser.raise (parser.js:1:1)`,
    };
}

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
 * Functional regression: a real babel code frame arrives colored for the
 * terminal. The browser has no terminal, so the page must show highlighted
 * source, never the escape codes themselves.
 */
tap.test(
    'colored code frames reach the browser as markup, not escapes',
    (t) => {
        const err = coloredFrameError();
        t.match(
            err.message,
            ANSI,
            'the error really is ansi colored to begin with'
        );

        const page = ErrorBundleGenerator.generateErrorPage(
            [err],
            'development'
        );

        t.notMatch(page, ANSI, 'no escape sequence survives into the page');
        t.notMatch(
            page,
            /\[39m|\[90m|\[36m/,
            'no escape code text is rendered'
        );
        t.match(
            page,
            /<span style="color:#[0-9a-f]{6}">/,
            'source is colorized'
        );
        t.match(
            page,
            /<span style="color:[^"]*;font-weight:bold">/,
            'the error pointer keeps its emphasis'
        );
        t.match(page, />return</, 'the source line is still readable');
        t.notMatch(page, /<div>/, 'source markup is still escaped');
        t.match(page, /&lt;/, 'source markup is shown escaped');

        const bundle = ErrorBundleGenerator.generate([err], {
            type: 'js',
            environment: 'development',
        });
        t.notMatch(
            bundle,
            ANSI,
            'the javascript bundle carries no escape codes'
        );
        t.match(
            bundle,
            /Unexpected token \(4:17\)/,
            'the console still gets the message'
        );

        const css = ErrorBundleGenerator.generate([err], {
            type: 'css',
            environment: 'development',
        });
        t.notMatch(css, ANSI, 'the css bundle carries no escape codes');

        t.end();
    }
);

/**
 * Unit regression: 256-colour and truecolour sequences carry their colour as
 * trailing arguments. Reading those arguments as codes of their own repainted
 * the text at random and swallowed emphasis around them.
 */
tap.test('extended colour sequences do not repaint the page', (t) => {
    const err = {
        id: './app/broken.js',
        environment: 'development',
        // 256-colour index 33, background index 31, bold around truecolour black
        message: `${ESC}[38;5;33mplain${ESC}[39m ${ESC}[48;5;31malso plain${ESC}[49m`,
        stack: `${ESC}[1m${ESC}[38;2;0;0;0mstill bold${ESC}[22m`,
    };

    const page = ErrorBundleGenerator.generateErrorPage([err], 'development');

    t.notMatch(page, ANSI, 'no escape sequence survives into the page');
    t.notMatch(
        page,
        /<span style="color:[^"]*">plain/,
        'a 256-colour index is not mistaken for a basic colour'
    );
    t.notMatch(
        page,
        /<span style="color:[^"]*">also plain/,
        'a background colour never becomes a foreground colour'
    );
    t.match(
        page,
        /<span style="font-weight:bold">still bold/,
        'emphasis survives a truecolour sequence'
    );

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
