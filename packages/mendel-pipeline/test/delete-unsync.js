const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const resolveVariations = require('mendel-development/resolve-variations');
const { stageFixture } = require('./helpers');

// Sources are mutated (a file is deleted, another is edited) so the fixture
// is copied rather than linked.
const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/error-project'),
    'delete-unsync',
    { copy: true }
);
const helperFile = path.join(appPath, 'app/helper.js');
// Not required by the "main" bundle's entry chain at all: proves the hang is
// global to the client's sync state, not scoped to what a bundle actually uses.
const unusedFile = path.join(appPath, 'app/unused.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
const ipcPath = path.join(os.tmpdir(), `mendel-du-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;
const cliPath = path.resolve(__dirname, '../src/cli.js');
const browserPack = path.resolve(__dirname, '../../mendel-outlet-browser-pack');
const throwingTransform = path.join(appPath, 'throwing-transform.js');

tap.setTimeout(180000);

const GOOD_SOURCE = fs.readFileSync(helperFile, 'utf8');
const EDITED_SOURCE = GOOD_SOURCE.replace('hello ', 'howdy ');
const BAD_SOURCE = GOOD_SOURCE + '\n// MENDEL_BREAK_ME\n';

const YAML = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

transforms: {}

types:
  js:
    extensions:
      - .js

outlets:
  - id: js-bundle
    plugin: ${browserPack}

bundles:
  main:
    outlet: js-bundle
    outfile: main.js
    entries:
      - ./main.js
`;

const ERROR_YAML = YAML.replace(
    'transforms: {}',
    `transforms:
  breaker:
    plugin: ${throwingTransform}`
).replace(
    `      - .js
`,
    `      - .js
    transforms:
      - breaker
`
);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBundle(output) {
    if (typeof output === 'string') return Promise.resolve(output);
    return new Promise((resolve, reject) => {
        let data = '';
        output.on('data', (chunk) => (data += chunk.toString()));
        output.on('end', () => resolve(data));
        output.on('error', reject);
    });
}

async function waitFor(predicate, timeout = 40000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await sleep(200);
    }
    return false;
}

// A hung request never settles, so it cannot be awaited directly: race it
// against a bounded timeout instead of trusting it to eventually resolve.
async function withTimeout(promise, ms, label) {
    const TIMED_OUT = Symbol('timed out');
    const result = await Promise.race([
        promise,
        sleep(ms).then(() => TIMED_OUT),
    ]);
    if (result === TIMED_OUT) {
        throw new Error(`${label} did not settle within ${ms}ms`);
    }
    return result;
}

function startDaemon() {
    const daemon = spawn(process.execPath, [cliPath, '--watch'], {
        cwd: appPath,
        env: Object.assign({}, process.env, {
            MENDEL_IPC: ipcPath,
            MENDEL_ENV: 'development',
            NODE_ENV: 'development',
        }),
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    daemon.stderr.resume();
    return daemon;
}

function variationsFor(client) {
    return resolveVariations(client.config.variationConfig.variations, [
        'base',
    ]);
}

function makeClient() {
    const prevCwd = process.cwd();
    process.chdir(appPath);
    delete require.cache[require.resolve('../client')];
    const BuildOnDemand = require('../client');
    const client = new BuildOnDemand({
        environment: 'development',
        noout: true,
        verbose: false,
    });
    client.run();
    process.chdir(prevCwd);
    return client;
}

/**
 * Functional: deleting a file the daemon watches — whether or not the bundle
 * being requested actually needs it — must not leave every subsequent bundle
 * request hanging forever. The client's sync flag has to recover on its own
 * once the daemon confirms the deletion is final, not wait for an unrelated
 * file event.
 */
tap.test('a deleted file does not leave bundle requests hanging', async (t) => {
    fs.writeFileSync(mendelrcPath, YAML);
    fs.writeFileSync(helperFile, GOOD_SOURCE);
    fs.writeFileSync(unusedFile, 'module.exports = "unused";\n');
    try {
        fs.unlinkSync(ipcPath);
    } catch (e) {
        /* no socket yet */
    }

    const daemon = startDaemon();
    let client;

    t.teardown(() => {
        if (client) client.exit();
        daemon.kill('SIGKILL');
        fs.writeFileSync(helperFile, GOOD_SOURCE);
        if (!fs.existsSync(unusedFile)) {
            fs.writeFileSync(unusedFile, 'module.exports = "unused";\n');
        }
        [mendelrcPath, ipcPath].forEach((file) => {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                /* already gone */
            }
        });
    });

    t.ok(
        await waitFor(() => fs.existsSync(ipcPath)),
        'builder comes up on its own socket'
    );

    client = makeClient();
    t.ok(
        await waitFor(() => client.canServeRequest()),
        'client syncs with builder'
    );

    const healthy = await readBundle(
        await client.build('main', variationsFor(client))
    );
    t.match(healthy, /hello/, 'healthy bundle contains the module source');

    // Waits for the client's own desync notification (rather than
    // polling canServeRequest() after firing the delete) since it is
    // still true on the very first poll: the fs event, the daemon's
    // removeEntry broadcast and the client's socket handling are all
    // asynchronous, so a synchronous read right after unlinkSync races
    // ahead of all of it and never observes anything changed.
    const desynced = new Promise((resolve) => client.once('change', resolve));

    // Deletes a file that nothing in the "main" bundle's require graph
    // references, matching the investigation's "unrelated file" scenario.
    fs.unlinkSync(unusedFile);

    await withTimeout(desynced, 20000, 'client leaving sync after the delete');
    t.pass('client leaves sync when a watched file is deleted');

    const resynced = await withTimeout(
        waitFor(() => client.canServeRequest(), 15000),
        20000,
        'waiting for the client to resync after the delete'
    );
    t.ok(resynced, 'client resyncs on its own after a final removal');

    const rebuilt = await readBundle(
        await withTimeout(
            client.build('main', variationsFor(client)),
            15000,
            'bundle request after an unrelated file was deleted'
        )
    );
    t.match(
        rebuilt,
        /hello/,
        'bundle request is answered instead of hanging forever'
    );
});

/**
 * Functional regression: editing a file goes through the same removeEntry
 * as a delete, immediately followed by an addEntry once the rebuild lands.
 * The client must stay unsynced for that whole window — resyncing early
 * would let a bundle request through while the edited module is still
 * missing from the registry.
 */
tap.test(
    'editing a file does not resync until the rebuild actually lands',
    async (t) => {
        fs.writeFileSync(mendelrcPath, YAML);
        fs.writeFileSync(helperFile, GOOD_SOURCE);
        fs.writeFileSync(unusedFile, 'module.exports = "unused";\n');
        try {
            fs.unlinkSync(ipcPath);
        } catch (e) {
            /* no socket yet */
        }

        const daemon = startDaemon();
        let client;

        t.teardown(() => {
            if (client) client.exit();
            daemon.kill('SIGKILL');
            fs.writeFileSync(helperFile, GOOD_SOURCE);
            [mendelrcPath, ipcPath].forEach((file) => {
                try {
                    fs.unlinkSync(file);
                } catch (e) {
                    /* already gone */
                }
            });
        });

        t.ok(await waitFor(() => fs.existsSync(ipcPath)), 'builder is up');

        client = makeClient();
        t.ok(
            await waitFor(() => client.canServeRequest()),
            'client syncs with builder'
        );

        const healthy = await readBundle(
            await client.build('main', variationsFor(client))
        );
        t.match(healthy, /hello/, 'healthy bundle contains the original text');

        // Waits for the client's own desync notification (rather than
        // polling canServeRequest() after firing the write) so the build() call
        // below is guaranteed to queue against an unsynced client instead
        // of racing the file watcher and hitting the stale bundle cache.
        const desynced = new Promise((resolve) =>
            client.once('change', resolve)
        );
        fs.writeFileSync(helperFile, EDITED_SOURCE);
        await withTimeout(
            desynced,
            20000,
            'client leaving sync after the edit'
        );
        t.notOk(
            client.canServeRequest(),
            'client is unsynced once the edit is detected'
        );

        // Request queued while genuinely unsynced: it must not resolve until
        // the real resync, so it can only ever see the old or the new
        // content in full, never a build missing the edited module.
        const pending = client.build('main', variationsFor(client));

        const edited = await readBundle(
            await withTimeout(pending, 20000, 'bundle request queued mid-edit')
        );
        t.match(
            edited,
            /howdy/,
            'queued request resolves with the edited content'
        );
        t.notMatch(
            edited,
            /\[Mendel Build Error\]/,
            'edit-triggered remove+add never resolves as a broken bundle'
        );
    }
);

/**
 * Functional regression: an entry that failed to build is excluded from the
 * builder's deliverable count and held as an error on the client. Deleting
 * that file has to clear the error alongside the entry and let the client
 * reach a clean synced state — otherwise the error outlives the file it
 * describes and every later request is answered with a stale error bundle.
 */
tap.test('deleting an errored file clears the error and resyncs', async (t) => {
    fs.writeFileSync(mendelrcPath, ERROR_YAML);
    fs.writeFileSync(helperFile, GOOD_SOURCE);
    try {
        fs.unlinkSync(ipcPath);
    } catch (e) {
        /* no socket yet */
    }

    const daemon = startDaemon();
    let client;

    t.teardown(() => {
        if (client) client.exit();
        daemon.kill('SIGKILL');
        fs.writeFileSync(helperFile, GOOD_SOURCE);
        [mendelrcPath, ipcPath].forEach((file) => {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                /* already gone */
            }
        });
    });

    t.ok(await waitFor(() => fs.existsSync(ipcPath)), 'builder is up');

    client = makeClient();
    t.ok(
        await waitFor(() => client.canServeRequest()),
        'client syncs with builder'
    );

    const broke = new Promise((resolve) => client.once('change', resolve));
    fs.writeFileSync(helperFile, BAD_SOURCE);
    await withTimeout(broke, 20000, 'client leaving sync after the bad edit');
    t.ok(
        await waitFor(
            () => client.getSyncState() === 'synced-with-errors',
            20000
        ),
        'client reaches synced-with-errors'
    );

    const removed = new Promise((resolve) => client.once('change', resolve));
    fs.unlinkSync(helperFile);
    await withTimeout(
        removed,
        20000,
        'client leaving sync after the errored file is deleted'
    );
    t.ok(
        await withTimeout(
            waitFor(() => client.canServeRequest(), 15000),
            20000,
            'waiting for the client to resync after deleting the errored file'
        ),
        'client resyncs after the errored file is deleted'
    );
    t.equal(
        client.getSyncState(),
        'synced',
        'the deleted file leaves no error behind'
    );

    const rebuilt = await readBundle(
        await withTimeout(
            client.build('main', variationsFor(client)),
            15000,
            'bundle request after the errored file was deleted'
        )
    );
    t.notMatch(
        rebuilt,
        /\[Mendel Build Error\]/,
        'no stale error bundle once the errored file is gone'
    );
});
