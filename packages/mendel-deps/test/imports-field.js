const test = require('tap').test;
const deps = require('../');
const { readFileSync } = require('fs');
const path = require('path');
const Resolver = require('../../mendel-resolver');

test('maps a "#" specifier instead of warning and recording false', function (t) {
    const fixtureDir = path.join(__dirname, 'fixtures/imports-field');
    const file = path.join(fixtureDir, 'main.js');
    const resolver = new Resolver({
        basedir: fixtureDir,
        cwd: fixtureDir,
        runtimes: ['browser', 'main'],
    });

    return deps({
        file,
        source: readFileSync(file, 'utf8'),
        resolver,
    }).then((result) => {
        t.ok(result['#env'], 'the require literal is mapped');
        t.match(result['#env'].browser, /src\/env\.browser\.js$/);
        t.match(result['#env'].main, /src\/env\.node\.js$/);
    });
});
