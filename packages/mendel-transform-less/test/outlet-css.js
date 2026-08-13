const path = require('path');
const { skip } = require('tap');
const rimraf = require('rimraf');
const fs = require('fs');
const Pipeline = require('../../mendel-pipeline');
const appPath = path.join(__dirname, './css-samples');
const buildPath = path.join(appPath, 'build');

rimraf.sync(buildPath);

// hangs waiting on the Pipeline's mendel-ipc socket outside a running daemon; unrelated to less output
skip('mendel-outlet-css sanity test', function (t) {
    t.plan(4);

    process.chdir(appPath);
    process.env.MENDELRC = '.mendelrc';

    const mendel = new Pipeline();
    mendel.run(function (error) {
        if (error) {
            console.error(error);
            return t.bailout('should create manifest but failed');
        }

        const css = fs.readFileSync(path.join(buildPath, 'main.css'), 'utf8');

        t.notMatch(css, 'background: red');
        t.has(css, 'padding: 0');
        t.has(css, 'background: blue');
        // From LESS
        t.has(css, 'background: #1111ff');
    });
});
