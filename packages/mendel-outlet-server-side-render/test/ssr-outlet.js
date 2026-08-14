const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const os = require('os');
const ServerSideRenderOutlet = require('../index.js');

test('ServerSideRenderOutlet.saveFileToDisk creates nested directories', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-ssr-'));

    t.teardown(async () => {
        // Clean up
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    const config = {
        baseConfig: {
            outdir: tempDir,
            dir: 'src',
        },
        variationConfig: {
            allDirs: ['src'],
        },
    };

    const outlet = new ServerSideRenderOutlet(config, { dir: 'ssr' });

    // This path includes non-existent nested directories
    const dest = path.join(tempDir, 'nested', 'deep', 'dirs', 'test-module.js');
    const source = 'module.exports = "test";';

    // This should not crash with "mkdirp is not a function"
    await outlet.saveFileToDisk(dest, source);

    // Verify the file was created
    const fileExists = fs.existsSync(dest);
    t.ok(fileExists, 'File should be created in nested directories');

    if (fileExists) {
        const content = fs.readFileSync(dest, 'utf-8');
        t.equal(content, source, 'File should contain the expected source');
    }
});

test('transformFile includes file path in parse error', async (t) => {
    const config = {
        baseConfig: {
            outdir: '/tmp',
            dir: 'src',
        },
        variationConfig: {
            allDirs: ['src'],
        },
    };

    const outlet = new ServerSideRenderOutlet(config, {
        dir: 'ssr',
        requireTransform: true,
    });

    // Entry with invalid JavaScript syntax (will fail during falafel parsing)
    const entry = {
        id: './src/broken.js',
        source: 'const x = 1 @@@;', // Invalid syntax
        rawSource: 'const x = 1 @@@;',
        map: '',
        deps: {},
    };

    const dest = '/tmp/ssr/src/broken.js';
    const configForTransform = { options: { runtime: 'main' } };

    t.throws(
        () => outlet.transformFile(entry, dest, configForTransform),
        /broken\.js/,
        'error message includes the file path'
    );
});

test('transformFile handles JSON with requireTransform disabled', async (t) => {
    const config = {
        baseConfig: {
            outdir: '/tmp',
            dir: 'src',
        },
        variationConfig: {
            allDirs: ['src'],
        },
    };

    const outlet = new ServerSideRenderOutlet(config, {
        dir: 'ssr',
        requireTransform: false,
    });

    // Entry with JSON content
    const entry = {
        id: './src/data.json',
        source: 'module.exports = {"a":1};', // Parsed JSON (as transformed by parser)
        rawSource: '{"a":1}', // Raw JSON
        map: '',
        deps: {},
    };

    const dest = '/tmp/ssr/src/data.json';
    const configForTransform = { options: { runtime: 'main' } };

    const result = outlet.transformFile(entry, dest, configForTransform);

    t.equal(
        result,
        '{"a":1}',
        'JSON should return rawSource without transformation'
    );
});

test('transformFile swaps JSON to rawSource before requireTransform', async (t) => {
    const config = {
        baseConfig: {
            outdir: '/tmp',
            dir: 'src',
        },
        variationConfig: {
            allDirs: ['src'],
        },
    };

    const outlet = new ServerSideRenderOutlet(config, {
        dir: 'ssr',
        requireTransform: true,
    });

    // No JSON parser configured, so source is still raw JSON: unparseable as JS
    const entry = {
        id: './src/data.json',
        source: '{"a":1}',
        rawSource: '{"a":1}',
        map: '',
        deps: {},
    };

    const dest = '/tmp/ssr/src/data.json';
    const configForTransform = { options: { runtime: 'main' } };

    const result = outlet.transformFile(entry, dest, configForTransform);

    t.equal(
        result,
        '{"a":1}',
        'JSON should skip requireTransform and use rawSource'
    );
});
