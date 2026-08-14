const test = require('tap').test;
const deps = require('../');
const { readFileSync } = require('fs');
const { globSync } = require('glob');
const path = require('path');
const Resolver = require('../../mendel-resolver');

const cssFixtures = globSync(__dirname + '/fixtures/css/**/*.css');

const cssResolver = new Resolver({
    cwd: __dirname,
    runtimes: ['browser', 'main'],
});

cssFixtures
    .filter((file) => file.endsWith('index.css'))
    .forEach((file) => {
        const dirname = path.dirname(file);
        cssResolver.setBaseDir(dirname);

        test(dirname, function (t) {
            return deps({
                file,
                source: readFileSync(file, 'utf8'),
                resolver: cssResolver,
            }).then((deps) => {
                t.equal(Object.keys(deps).length, 2);

                t.equal(
                    deps["url('./foo.css')"],
                    false,
                    'url is not traversed or imported, it is treated as an external/lazy dependency'
                );

                const barDep = deps['./bar.css'];
                t.match(barDep.browser, /bar\.css$/);
                t.match(barDep.main, /bar\.css$/);
            });
        });
    });
