'use strict';

const path = require('path');
const { createRequire } = require('module');

// node-stdlib-browser is the maintained webpack-4-style Node core map.
// Its public export collapses non-relative targets to package roots (for
// bundler alias). Mendel reads shim paths as files, so re-resolve the same
// package specifiers to concrete entry files from that package's install tree.
const stdlibPkgJson = require.resolve('node-stdlib-browser/package.json');
const stdlibRoot = path.dirname(stdlibPkgJson);
const requireFromStdlib = createRequire(stdlibPkgJson);
const requireFromCjs = createRequire(path.join(stdlibRoot, 'cjs', 'index.js'));

// Specifiers mirror node-stdlib-browser's cjs/index.js resolvePath(...) calls.
const SPECIFIERS = {
    assert: 'assert/',
    buffer: 'buffer/',
    child_process: './mock/empty.js',
    cluster: './mock/empty.js',
    console: 'console-browserify',
    constants: 'constants-browserify',
    crypto: 'crypto-browserify',
    dgram: './mock/empty.js',
    dns: './mock/empty.js',
    domain: 'domain-browser',
    events: 'events/',
    fs: './mock/empty.js',
    http: 'stream-http',
    https: 'https-browserify',
    http2: './mock/empty.js',
    module: './mock/empty.js',
    net: './mock/empty.js',
    os: 'os-browserify/browser.js',
    path: 'path-browserify',
    punycode: 'punycode/',
    process: './proxy/process.js',
    querystring: './proxy/querystring.js',
    readline: './mock/empty.js',
    repl: './mock/empty.js',
    stream: 'stream-browserify',
    _stream_duplex: 'readable-stream/lib/_stream_duplex.js',
    _stream_passthrough: 'readable-stream/lib/_stream_passthrough.js',
    _stream_readable: 'readable-stream/lib/_stream_readable.js',
    _stream_transform: 'readable-stream/lib/_stream_transform.js',
    _stream_writable: 'readable-stream/lib/_stream_writable.js',
    string_decoder: 'string_decoder/',
    sys: 'util/util.js',
    'timers/promises': 'isomorphic-timers-promises',
    timers: 'timers-browserify',
    tls: './mock/empty.js',
    tty: 'tty-browserify',
    url: './proxy/url.js',
    util: 'util/util.js',
    vm: 'vm-browserify',
    zlib: 'browserify-zlib',
};

function resolveSpecifier(spec) {
    if (spec.startsWith('./')) {
        return requireFromCjs.resolve(spec);
    }
    return requireFromStdlib.resolve(spec);
}

function buildDefaultShims() {
    const shims = {};
    Object.keys(SPECIFIERS).forEach((name) => {
        const file = resolveSpecifier(SPECIFIERS[name]);
        shims[name] = file;
        shims[`node:${name}`] = file;
    });
    return shims;
}

module.exports = buildDefaultShims();
