const test = require('tap').test;
const deps = require('../');
const { readFileSync } = require('fs');
const { globSync } = require('fs');
const path = require('path');
const Resolver = require('../../mendel-resolver');

const jsFixtures = globSync(__dirname + '/fixtures/js/**/*.js');

const jsResolver = new Resolver({
    basedir: __dirname,
    runtimes: ['browser', 'main'],
});

jsFixtures
    .filter((file) => file.endsWith('index.js'))
    .forEach((file) => {
        const dirname = path.dirname(file);
        jsResolver.setBaseDir(dirname);

        test(dirname, function (t) {
            return deps({
                file,
                source: readFileSync(file, 'utf8'),
                resolver: jsResolver,
            }).then((deps) => {
                // foo, process, and global
                t.equal(Object.keys(deps).length, 3);

                const fooDep = deps['./foo'];
                t.match(fooDep.browser, /foo\/browser.js$/);
                t.match(fooDep.main, /foo\/server.js$/);
            });
        });
    });
