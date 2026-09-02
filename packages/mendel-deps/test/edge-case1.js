const test = require('tap').test;
const deps = require('../');
const { readFileSync, globSync } = require('fs');
const path = require('path');
const Resolver = require('../../mendel-resolver');

const jsFixtures = globSync(__dirname + '/fixtures/js/**/*.js', {
    absolute: true,
});

const jsResolver = new Resolver({
    basedir: __dirname,
    runtimes: ['browser', 'main'],
});

jsFixtures
    .filter((file) => file.endsWith('require-edge-case.js'))
    .forEach((file) => {
        const dirname = path.dirname(file);
        jsResolver.setBaseDir(dirname);

        test(dirname, function (t) {
            return deps({
                file,
                source: readFileSync(file, 'utf8'),
                resolver: jsResolver,
            }).then((deps) => {
                t.match(Object.keys(deps)[0], /index\.js$/);
            });
        });
    });
