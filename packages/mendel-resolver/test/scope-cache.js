const { test } = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Resolver = require('../');

function stageProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mendel-scope-cache-'));
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/first.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/second.js'), 'module.exports = 2;\n');
    writeImports(dir, './src/first.js');
    return dir;
}

function writeImports(dir, target) {
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
            name: 'scope-cache-fixture',
            imports: { '#dep': target },
        })
    );
}

function createResolver(dir) {
    return new Resolver({
        cwd: dir,
        basedir: path.join(dir, 'src'),
        runtimes: ['main'],
    });
}

test('an edited "imports" map is stale until the scope cache is cleared', (t) => {
    const dir = stageProject();
    t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));

    const resolver = createResolver(dir);
    return resolver
        .resolve('#dep')
        .then((resolved) => {
            t.same(
                resolved,
                { main: './src/first.js' },
                'resolves the map on disk'
            );
            writeImports(dir, './src/second.js');
            return resolver.resolve('#dep');
        })
        .then((resolved) => {
            t.same(
                resolved,
                { main: './src/first.js' },
                'cached scope still answers with the pre-edit map'
            );
            resolver.clearCache();
            return resolver.resolve('#dep');
        })
        .then((resolved) => {
            t.same(
                resolved,
                { main: './src/second.js' },
                'clearCache makes the next resolution re-read package.json'
            );
        });
});

test('clearCache empties every cached package scope', (t) => {
    const dir = stageProject();
    t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));

    const resolver = createResolver(dir);
    return resolver.resolve('#dep').then(() => {
        t.ok(resolver._scopeCache.size > 0, 'scope lookups were cached');
        resolver.clearCache();
        t.equal(resolver._scopeCache.size, 0, 'no scope entry survives');
    });
});
