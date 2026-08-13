const path = require('path');
const { test } = require('tap');
const rimraf = require('rimraf');
const fs = require('fs');
const Pipeline = require('../../mendel-pipeline');
const appPath = path.join(__dirname, './css-samples');
const buildPath = path.join(appPath, 'build');

rimraf.sync(buildPath);
rimraf.sync(path.join(appPath, '.mendelipc'));

test('mendel-outlet-css sanity test', function (t) {
    t.plan(4);

    process.chdir(appPath);
    process.env.MENDELRC = '.mendelrc';

    const mendel = new Pipeline();
    mendel.run(function (error) {
        try {
            if (error) {
                console.error(error);
                return t.bailout('should create manifest but failed');
            }

            const css = fs.readFileSync(
                path.join(buildPath, 'main.css'),
                'utf8'
            );

            t.notMatch(css, /background: red/);
            t.match(css, /padding: 0/);
            t.match(css, /background: blue/);
            // From LESS
            t.match(css, /background: #1111ff/);
        } finally {
            // Daemon leaves IPC handles open; same as CLI after build.
            if (typeof mendel.onForceExit === 'function') {
                try {
                    mendel.onForceExit();
                } catch (e) {
                    /* ignore */
                }
            }
            setImmediate(() => process.exit(t.passing() ? 0 : 1));
        }
    });
});
