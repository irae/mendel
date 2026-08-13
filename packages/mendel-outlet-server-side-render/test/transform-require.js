const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const os = require('os');
const replaceRequiresOnSource = require('../transform-require');
const wrapper = replaceRequiresOnSource.wrapper;

function createEntry(source) {
    return {
        source,
        deps: {},
        id: 'test-module',
    };
}

function roundTripExecution(transformedCode) {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `test-module-${Date.now()}.js`);

    try {
        fs.writeFileSync(tempFile, transformedCode, 'utf-8');
        delete require.cache[tempFile];
        const moduleFunc = require(tempFile);
        return { moduleFunc, success: true };
    } catch (err) {
        return { error: err, success: false };
    } finally {
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            // ignore cleanup errors
        }
    }
}

test('relative require is transformed to __mendel_require__', function (t) {
    const source = "const foo = require('./foo');";
    const entry = createEntry(source);
    entry.deps = {
        './foo': {
            main: 'resolved-id-foo',
        },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const dest = '/app/modules/test-module.js';
    const transformed = replaceRequiresOnSource(dest, entry, getDepPath);

    t.match(
        transformed,
        "__mendel_require__('resolved-id-foo')",
        'relative require transformed to __mendel_require__'
    );
    t.notMatch(
        transformed,
        "require('./foo')",
        'original relative require removed'
    );
    t.end();
});

test('bare npm require is left untouched', function (t) {
    const source = "const react = require('react');";
    const entry = createEntry(source);

    const getDepPath = () => {
        throw new Error('should not be called for bare requires');
    };

    const dest = '/app/modules/test-module.js';
    const transformed = replaceRequiresOnSource(dest, entry, getDepPath);

    t.match(transformed, "require('react')", 'bare npm require left untouched');
    t.notMatch(
        transformed,
        "__mendel_require__('react')",
        'bare npm require not transformed'
    );
    t.end();
});

test('absolute path require is transformed to relative path', function (t) {
    const source = "const config = require('/etc/config.js');";
    const entry = createEntry(source);

    const getDepPath = () => {
        throw new Error('should not be called for absolute requires');
    };

    const dest = '/app/modules/test-module.js';
    const transformed = replaceRequiresOnSource(dest, entry, getDepPath);

    t.match(
        transformed,
        "require('../../etc/config.js')",
        'absolute path converted to relative path'
    );
    t.notMatch(
        transformed,
        "require('/etc/config.js')",
        'original absolute path removed'
    );
    t.end();
});

test('output is wrapped with __mendel_module__ marker', function (t) {
    const source = 'const x = 1;';
    const entry = createEntry(source);

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        () => {}
    );

    t.equal(transformed.indexOf(wrapper[0]), 0, 'wrapper prelude at start');
    t.equal(
        transformed.indexOf(wrapper[1]),
        transformed.length - wrapper[1].length,
        'wrapper epilogue at end'
    );
    t.match(
        transformed,
        /module\.exports\.__mendel_module__ = true/,
        '__mendel_module__ marker present'
    );
    t.end();
});

test('multiple requires in same source', function (t) {
    const source = [
        "const foo = require('./foo');",
        "const bar = require('./bar');",
        "const react = require('react');",
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './foo': { main: 'resolved-foo' },
        './bar': { main: 'resolved-bar' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );

    t.match(
        transformed,
        "__mendel_require__('resolved-foo')",
        'first relative require transformed'
    );
    t.match(
        transformed,
        "__mendel_require__('resolved-bar')",
        'second relative require transformed'
    );
    t.match(transformed, "require('react')", 'bare require left untouched');
    t.end();
});

test('require inside function body is transformed', function (t) {
    const source = [
        'function loadModule() {',
        "  const foo = require('./foo');",
        '  return foo;',
        '}',
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './foo': { main: 'resolved-foo' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );

    t.match(
        transformed,
        "__mendel_require__('resolved-foo')",
        'require inside function body is transformed'
    );
    t.end();
});

test('require inside conditional is transformed', function (t) {
    const source = [
        'if (condition) {',
        "  const foo = require('./foo');",
        '}',
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './foo': { main: 'resolved-foo' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );

    t.match(
        transformed,
        "__mendel_require__('resolved-foo')",
        'require inside conditional is transformed'
    );
    t.end();
});

test('source with no requires is wrapped but not modified', function (t) {
    const source = [
        'const x = 1;',
        'const y = 2;',
        'module.exports = x + y;',
    ].join('\n');

    const entry = createEntry(source);
    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        () => {}
    );

    t.match(transformed, 'const x = 1;', 'source content preserved');
    t.match(transformed, 'const y = 2;', 'source content preserved');
    t.match(transformed, 'module.exports = x + y;', 'source content preserved');
    t.match(transformed, wrapper[0], 'wrapper prelude present');
    t.match(transformed, wrapper[1], 'wrapper epilogue present');
    t.end();
});

test('require as bare identifier (not a call) is not transformed', function (t) {
    const source = [
        'const requireFunc = require;',
        "const foo = require('./foo');",
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './foo': { main: 'resolved-foo' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );

    t.match(
        transformed,
        'const requireFunc = require;',
        'bare require identifier left untouched'
    );
    t.match(
        transformed,
        "__mendel_require__('resolved-foo')",
        'require call still transformed'
    );
    t.end();
});

test('round-trip execution with relative require', function (t) {
    const source = [
        'const value = 42;',
        "const dep = require('./dep');",
        'module.exports = value + dep;',
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './dep': { main: 'dep-resolved-id' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );
    const { moduleFunc, success } = roundTripExecution(transformed);

    if (!success) {
        t.fail('Failed to load transformed module: ' + transformed);
        return t.end();
    }

    t.ok(moduleFunc, 'module exports a function');
    t.ok(moduleFunc.__mendel_module__, '__mendel_module__ marker is set');

    const mendel_requires = [];
    const mockMendelRequire = (id) => {
        mendel_requires.push(id);
        return 8;
    };

    const mockModule = { exports: {} };
    const mockExports = {};
    moduleFunc(mockMendelRequire, mockModule, mockExports);

    t.match(
        mendel_requires,
        ['dep-resolved-id'],
        'stub __mendel_require__ called with correct id'
    );
    t.equal(mockModule.exports, 50, 'result is 42 + 8 = 50');
    t.end();
});

test('round-trip execution with bare npm require (structure only)', function (t) {
    const source = [
        "const lodash = require('lodash');",
        'module.exports = lodash;',
    ].join('\n');

    const entry = createEntry(source);
    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        () => {}
    );

    t.match(
        transformed,
        "require('lodash')",
        'bare npm require left untouched in transformed code'
    );
    t.match(transformed, wrapper[0], 'wrapper prelude present');
    t.match(transformed, wrapper[1], 'wrapper epilogue present');
    t.match(
        transformed,
        /module\.exports\.__mendel_module__ = true/,
        '__mendel_module__ marker present'
    );
    t.end();
});

test('round-trip execution with multiple requires (relative only)', function (t) {
    const source = [
        "const foo = require('./foo');",
        "const bar = require('./bar');",
        'module.exports = { foo, bar };',
    ].join('\n');

    const entry = createEntry(source);
    entry.deps = {
        './foo': { main: 'id-foo' },
        './bar': { main: 'id-bar' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );
    const { moduleFunc, success } = roundTripExecution(transformed);

    if (!success) {
        t.fail('Failed to load transformed module');
        return t.end();
    }

    const mendel_requires = [];
    const mockMendelRequire = (id) => {
        mendel_requires.push(id);
        return { id };
    };

    const mockModule = { exports: {} };
    const mockExports = {};
    moduleFunc(mockMendelRequire, mockModule, mockExports);

    t.match(
        mendel_requires,
        ['id-foo', 'id-bar'],
        'both relative requires called with correct ids'
    );
    t.equal(mendel_requires.length, 2, 'exactly two mendel requires called');
    t.end();
});

test('parent directory relative requires are transformed', function (t) {
    const source = "const parent = require('../sibling');";
    const entry = createEntry(source);
    entry.deps = {
        '../sibling': { main: 'resolved-sibling' },
    };

    const getDepPath = (ent, mod) => {
        if (!ent.deps[mod]) return mod;
        return ent.deps[mod].main;
    };

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        getDepPath
    );

    t.match(
        transformed,
        "__mendel_require__('resolved-sibling')",
        'parent directory relative require transformed'
    );
    t.end();
});

test('require with no argument is not transformed', function (t) {
    const source = 'const x = require();';
    const entry = createEntry(source);

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        () => {}
    );

    t.match(
        transformed,
        'require();',
        'require with no argument left untouched'
    );
    t.end();
});

test('require with non-literal argument is not transformed', function (t) {
    const source = 'const x = require(variable);';
    const entry = createEntry(source);

    const transformed = replaceRequiresOnSource(
        '/app/test.js',
        entry,
        () => {}
    );

    t.match(
        transformed,
        'require(variable);',
        'require with variable argument left untouched'
    );
    t.end();
});
