const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const os = require('os');
const BrowserPackOutlet = require('../src/index.js');

function lastNonEmptyLine(text) {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() !== '') return lines[i];
    }
    return '';
}

function extractEvalPayloads(body) {
    const out = [];
    let i = 0;
    while ((i = body.indexOf('eval("', i)) !== -1) {
        let k = i + 5;
        let literal = '"';
        k += 1;
        while (k < body.length) {
            const c = body[k];
            literal += c;
            if (c === '\\') {
                literal += body[k + 1] || '';
                k += 2;
                continue;
            }
            if (c === '"') break;
            k += 1;
        }
        try {
            out.push(JSON.parse(literal));
        } catch (e) {
            /* skip malformed */
        }
        i = k + 1;
    }
    return out;
}

function collectStream(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
}

function decodeTrailingMap(body) {
    const line = lastNonEmptyLine(body);
    const b64 = line.split('base64,').pop();
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function makeEntry({ id, source, deps, map }) {
    const entry = {
        id,
        normalizedId: id.replace(/^\.\//, '').replace(/\.js$/, ''),
        source,
        deps: deps || {},
        runtime: 'browser',
        variation: 'src',
        entry: true,
        expose: null,
    };
    if (map !== false) {
        entry.map = map || {
            version: 3,
            file: id,
            sources: [id.replace(/^\.\//, '')],
            names: [],
            mappings: 'AAAA',
            sourcesContent: [source],
        };
    }
    return entry;
}

function makeOutlet() {
    return new BrowserPackOutlet({
        baseConfig: { dir: 'src' },
        projectRoot: '/apps/myapp',
        noout: false,
    });
}

test('sourceMappingURL is the last non-empty line when process is in the graph', async (t) => {
    const outlet = makeOutlet();
    const entry = makeEntry({
        id: './src/app.js',
        source: 'console.log(process.env.NODE_ENV);',
        deps: { process: { browser: 'process' } },
    });
    const entries = new Map([[entry.normalizedId, entry]]);

    const stream = await outlet.perform(
        { entries, options: {}, id: 'test-bundle' },
        ['src']
    );
    const body = await collectStream(stream);

    t.ok(
        lastNonEmptyLine(body).startsWith(
            '//# sourceMappingURL=data:application/json'
        ),
        'last non-empty line is the pack sourceMappingURL comment'
    );
    const mapIdx = body.lastIndexOf('//# sourceMappingURL=');
    const closeIdx = body.lastIndexOf('})();');
    t.ok(closeIdx !== -1, 'IIFE appendix is present');
    t.ok(closeIdx < mapIdx, '})(); appears before sourceMappingURL');
    t.ok(
        body.startsWith('(function(){'),
        'pack includes the process/global prelude'
    );
});

test('outfile path also ends with the sourceMappingURL comment', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-bp-'));
    t.teardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    const outfile = path.join(tempDir, 'bundle.js');
    const outlet = makeOutlet();
    const entry = makeEntry({
        id: './src/app.js',
        source: 'console.log(process.env.NODE_ENV);',
        deps: { process: { browser: 'process' } },
    });
    const entries = new Map([[entry.normalizedId, entry]]);

    await outlet.perform({ entries, options: { outfile }, id: 'test-bundle' }, [
        'src',
    ]);

    const body = fs.readFileSync(outfile, 'utf8');
    t.ok(
        lastNonEmptyLine(body).startsWith(
            '//# sourceMappingURL=data:application/json'
        ),
        'outfile last non-empty line is the pack sourceMappingURL comment'
    );
    const mapIdx = body.lastIndexOf('//# sourceMappingURL=');
    const closeIdx = body.lastIndexOf('})();');
    t.ok(closeIdx !== -1 && closeIdx < mapIdx, '})(); before map in outfile');
    t.notOk(
        fs.existsSync(outfile + '.map'),
        'the map is interleaved, never a sibling file'
    );
});

test('wrap is absent when the graph has no process or global', async (t) => {
    const outlet = makeOutlet();
    const entry = makeEntry({
        id: './src/plain.js',
        source: 'module.exports = 1;',
        deps: {},
    });
    const entries = new Map([[entry.normalizedId, entry]]);

    const stream = await outlet.perform(
        { entries, options: {}, id: 'plain-bundle' },
        ['src']
    );
    const body = await collectStream(stream);

    t.notOk(body.includes('})();'), 'no IIFE appendix without process/global');
    t.ok(
        lastNonEmptyLine(body).startsWith(
            '//# sourceMappingURL=data:application/json'
        ),
        'still ends with the pack sourceMappingURL comment'
    );
});

test('each mapped module is an eval payload with its own last-line map', async (t) => {
    const outlet = makeOutlet();
    const entry = makeEntry({
        id: './src/app.js',
        source: 'module.exports = function App() { return 1; };',
        deps: { process: { browser: 'process' } },
    });
    const entries = new Map([[entry.normalizedId, entry]]);

    const stream = await outlet.perform(
        { entries, options: {}, id: 'eval-bundle' },
        ['src']
    );
    const body = await collectStream(stream);
    const payloads = extractEvalPayloads(body);

    t.ok(payloads.length >= 1, 'pack contains eval() module wrappers');
    const payload = payloads.find((p) => p.includes('function App'));
    t.ok(payload, 'App module is inside an eval payload');
    t.equal(
        lastNonEmptyLine(payload),
        '//# sourceURL=mendel://myapp/src/app.js',
        'eval last line is sourceURL with a colon so DevTools accepts it'
    );
    const lines = payload.split('\n').filter((l) => l.trim() !== '');
    t.ok(
        lines[lines.length - 2].startsWith(
            '//# sourceMappingURL=data:application/json;base64,'
        ),
        'eval second-to-last line is the module map'
    );
    t.ok(
        payload.startsWith('module.exports = function App'),
        'eval payload is the original module source, not the pack wrapper'
    );
    const mapLine = payload
        .split('\n')
        .find((l) => l.startsWith('//# sourceMappingURL=data:'));
    const evalMap = JSON.parse(
        Buffer.from(mapLine.split('base64,').pop(), 'base64').toString('utf8')
    );
    t.ok(
        evalMap.sources.some((s) => s.indexOf('mendel://myapp/') === 0),
        'eval map sources share the sourceURL host so Chrome remaps in place'
    );
    t.equal(
        evalMap.file,
        'mendel://myapp/src/app.js',
        'eval map file matches the sourceURL'
    );
});

test('modules without a map are packed as plain source', async (t) => {
    const outlet = makeOutlet();
    const entry = makeEntry({
        id: './node_modules/dep/index.js',
        source: 'module.exports = function vendorDep() { return 2; };',
        deps: {},
        map: false,
    });
    const entries = new Map([[entry.normalizedId, entry]]);

    const stream = await outlet.perform(
        { entries, options: {}, id: 'vendor-bundle' },
        ['src']
    );
    const body = await collectStream(stream);

    t.ok(body.includes('function vendorDep'), 'vendor source is in the pack');
    t.notOk(
        extractEvalPayloads(body).some((p) => p.includes('vendorDep')),
        'unmapped module is not eval-wrapped'
    );
    const packMap = decodeTrailingMap(body);
    t.ok(
        (packMap.sources || []).some((s) =>
            s.includes('node_modules/dep/index.js')
        ),
        'pack map still names the module file for stack traces'
    );
});
