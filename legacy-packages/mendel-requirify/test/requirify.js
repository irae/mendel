const tap = require('tap');
const fs = require('fs');
const os = require('os');
const path = require('path');

const browserify = require('browserify');
const requirify = require('../');

const fixtures = path.join(__dirname, 'fixtures');
const entry = path.join(fixtures, 'entry.js');
// entry-skip.js requires no variation-matched module, so bundling it never
// exercises the write path — needed to test the skip branches in isolation.
const entrySkip = path.join(fixtures, 'entry-skip.js');
const dirs = ['variantA'];

let counter = 0;
function tmpOutdir() {
    counter += 1;
    return path.join(
        os.tmpdir(),
        'mendel-requirify-test-' + process.pid + '-' + counter
    );
}

// out.end(...) in index.js has no completion callback, so the write can
// still be in flight when the bundle stream ends; settle before asserting.
function bundle(b) {
    return new Promise((resolve, reject) => {
        const s = b.bundle();
        s.on('error', reject);
        s.resume();
        s.on('end', () => setTimeout(resolve, 200));
    });
}

tap.test(
    'writes a transformed copy of each variation-matched module',
    async (t) => {
        const outdir = tmpOutdir();
        const b = browserify([entry]);
        requirify(b, { outdir, dirs });

        await bundle(b);

        const mainPath = path.join(outdir, 'variantA', 'main.js');
        const helperPath = path.join(outdir, 'variantA', 'helper.js');
        t.ok(fs.existsSync(mainPath), 'writes variantA/main.js');
        t.ok(fs.existsSync(helperPath), 'writes variantA/helper.js');

        const rawSource = fs.readFileSync(
            path.join(fixtures, 'variantA', 'helper.js'),
            'utf8'
        );
        const writtenSource = fs.readFileSync(helperPath, 'utf8');

        t.not(
            writtenSource,
            rawSource,
            'written source differs from the raw fixture source'
        );
        t.match(
            writtenSource,
            /__mendel_module__/,
            'written source carries the mendel require-transform wrapper'
        );

        fs.rmSync(outdir, { recursive: true, force: true });
        t.end();
    }
);

tap.test('creates missing output directories', async (t) => {
    const outdir = path.join(tmpOutdir(), 'a', 'b', 'c', 'd');
    t.notOk(fs.existsSync(outdir), 'outdir does not exist yet');

    const b = browserify([entry]);
    requirify(b, { outdir, dirs });

    await bundle(b);

    const mainPath = path.join(outdir, 'variantA', 'main.js');
    t.ok(
        fs.existsSync(mainPath),
        'writes into the deeply nested outdir it created'
    );

    rimraf.sync(outdir);
    t.end();
});

tap.test('skips modules under node_modules', async (t) => {
    const outdir = tmpOutdir();
    const b = browserify([entrySkip]);
    requirify(b, { outdir, dirs });

    await bundle(b);

    // node_modules/variantA resolves under the same "variantA" chain name;
    // if the node_modules skip were broken, it would land here instead.
    const nodeModulesOutput = path.join(outdir, 'variantA', 'index.js');
    t.notOk(
        fs.existsSync(nodeModulesOutput),
        'does not write a file for the node_modules package'
    );

    rimraf.sync(outdir);
    t.end();
});

tap.test('skips modules outside the variation chain', async (t) => {
    const outdir = tmpOutdir();
    const b = browserify([entrySkip]);
    requirify(b, { outdir, dirs });

    await bundle(b);

    t.notOk(
        fs.existsSync(path.join(outdir, 'base')),
        'does not write base-tree modules that have no variation match'
    );

    rimraf.sync(outdir);
    t.end();
});

tap.test('re-registers its hooks when browserify resets', async (t) => {
    const outdir = tmpOutdir();
    const b = browserify([entry]);
    requirify(b, { outdir, dirs });

    await bundle(b);
    rimraf.sync(outdir);
    t.notOk(fs.existsSync(outdir), 'cleared output between bundle runs');

    await bundle(b);

    const mainPath = path.join(outdir, 'variantA', 'main.js');
    t.ok(
        fs.existsSync(mainPath),
        'still writes output on the second bundle from the same instance'
    );

    rimraf.sync(outdir);
    t.end();
});
