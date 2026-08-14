const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const resolveVariations = require('mendel-development/resolve-variations');

const appPath = path.resolve(__dirname, './error-handling-samples');
const brokenFile = path.join(appPath, 'app/helper.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
// Unix socket paths are capped near 104 bytes; a path under the fixture would
// silently truncate on a deep checkout.
const ipcPath = path.join(os.tmpdir(), `mendel-eh-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;
const cliPath = path.resolve(__dirname, '../src/cli.js');
const browserPack = path.resolve(__dirname, '../../mendel-outlet-browser-pack');

// Spawning a real builder, syncing, breaking a file and recovering does not fit
// in tap's default 30s budget.
tap.setTimeout(180000);

const throwingTransform = path.join(appPath, 'throwing-transform.js');
const GOOD_SOURCE = fs.readFileSync(brokenFile, 'utf8');
const BAD_SOURCE = GOOD_SOURCE + '\n// MENDEL_BREAK_ME\n';

const YAML = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs: []
  variations: {}

transforms:
  breaker:
    plugin: ${throwingTransform}

types:
  js:
    extensions:
      - .js
    transforms:
      - breaker

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

const UNPARSEABLE_YAML = `base-config:
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
  notes:
    outlet: js-bundle
    outfile: notes.js
    entries:
      - ./uses-notes.js
`;

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
 * Functional: a syntax error in one source file must not silently produce a
 * bundle missing that module. Every bundle request of the environment answers
 * promptly with an error bundle naming the file, and fixing the file on disk
 * restores the real bundle with no daemon or client restart.
 */
tap.test('daemon and client serve error bundles over a socket', async (t) => {
    fs.writeFileSync(mendelrcPath, YAML);
    fs.writeFileSync(brokenFile, GOOD_SOURCE);
    try {
        fs.unlinkSync(ipcPath);
    } catch (e) {
        /* no socket yet */
    }

    const daemon = startDaemon();
    let client;
    let lateClient;

    t.teardown(() => {
        if (client) client.exit();
        if (lateClient) lateClient.exit();
        daemon.kill('SIGKILL');
        fs.writeFileSync(brokenFile, GOOD_SOURCE);
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
    t.ok(await waitFor(() => client.isSynced()), 'client syncs with builder');
    t.equal(client.getSyncState(), 'synced', 'a healthy build is fully synced');

    const healthy = await readBundle(
        await client.build('main', variationsFor(client))
    );
    t.match(healthy, /hello/, 'healthy bundle contains the module source');

    fs.writeFileSync(brokenFile, BAD_SOURCE);

    t.ok(
        await waitFor(() => client.client.hasErrors()),
        'client learns about the build error'
    );
    t.ok(
        await waitFor(() => client.isSynced()),
        'errored environment still becomes servable'
    );
    t.equal(
        client.getSyncState(),
        'synced-with-errors',
        'sync state distinguishes an errored build from a healthy one'
    );

    const [errored] = client.client.getErrors();
    t.match(errored.id, /helper\.js/, 'error names the file that broke');
    t.ok(errored.message.length > 0, 'error carries a message over the wire');
    t.ok(errored.stack.length > 0, 'error carries a stack over the wire');
    t.equal(
        errored.environment,
        'development',
        'error carries the environment it happened in'
    );

    const errorBundle = await readBundle(
        await client.build('main', variationsFor(client), { type: 'js' })
    );
    t.match(
        errorBundle,
        /\[Mendel Build Error\]/,
        'bundle request answers with the error bundle'
    );
    t.match(errorBundle, /helper\.js/, 'error bundle names the broken file');
    t.notMatch(
        errorBundle,
        /hello/,
        'error bundle replaces the bundle instead of truncating it'
    );

    const cssBundle = await client.build('main', variationsFor(client), {
        type: 'css',
    });
    t.match(
        cssBundle,
        /^\/\* \[Mendel\] Build Error/,
        'a text/css request gets a stylesheet-safe error bundle'
    );
    t.notMatch(
        cssBundle.slice(2, -2),
        /\*\//,
        'error text cannot terminate the css comment early'
    );

    lateClient = makeClient();
    let stateAtFirstSync = null;
    lateClient.on('ready', () => {
        if (stateAtFirstSync === null) {
            stateAtFirstSync = lateClient.getSyncState();
        }
    });
    t.ok(
        await waitFor(() => lateClient.isSynced()),
        'a client connecting during an error still syncs'
    );
    t.equal(
        stateAtFirstSync,
        'synced-with-errors',
        'a late client knows about errors no later than it reaches synced'
    );
    const lateBundle = await readBundle(
        await lateClient.build('main', variationsFor(lateClient))
    );
    t.match(
        lateBundle,
        /\[Mendel Build Error\]/,
        'a late client is served the error bundle, not a truncated one'
    );

    t.equal(daemon.exitCode, null, 'daemon survived the build error');

    fs.writeFileSync(brokenFile, GOOD_SOURCE);
    t.ok(
        await waitFor(() => client.isSynced() && !client.client.hasErrors()),
        'client recovers once the file is fixed'
    );
    const recovered = await readBundle(
        await client.build('main', variationsFor(client))
    );
    t.match(recovered, /hello/, 'fixed file restores the real bundle');
    t.equal(
        recovered.length,
        healthy.length,
        'recovered bundle matches the original build'
    );
});

/**
 * Functional: reconnecting to a healthy builder must not start out with the
 * errors of the connection that dropped.
 */
tap.test(
    'errored entries are cleared when the builder goes away',
    async (t) => {
        fs.writeFileSync(mendelrcPath, YAML);
        fs.writeFileSync(brokenFile, BAD_SOURCE);
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
            fs.writeFileSync(brokenFile, GOOD_SOURCE);
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
            await waitFor(() => client.client.hasErrors()),
            'client picks up the pre-existing error'
        );

        daemon.kill('SIGKILL');

        t.ok(
            await waitFor(() => !client.client.hasErrors()),
            'disconnecting from the builder clears the error state'
        );
        t.equal(
            client.getSyncState(),
            'unsynced',
            'a disconnected client is unsynced'
        );
    }
);

/**
 * Functional regression: bundle generation runs synchronously off the "sync"
 * event. A generator that throws — e.g. a required file whose extension has no
 * configured parser — used to take the host application process down on its
 * very first sync instead of failing the request.
 */
tap.test(
    'a failing generator rejects the request, not the process',
    async (t) => {
        fs.writeFileSync(mendelrcPath, UNPARSEABLE_YAML);
        try {
            fs.unlinkSync(ipcPath);
        } catch (e) {
            /* no socket yet */
        }

        const daemon = startDaemon();
        let client;
        let uncaught = null;
        const onUncaught = (error) => (uncaught = error);
        process.on('uncaughtException', onUncaught);

        t.teardown(() => {
            process.removeListener('uncaughtException', onUncaught);
            if (client) client.exit();
            daemon.kill('SIGKILL');
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
            await waitFor(() => client.isSynced()),
            'client syncs with builder'
        );

        await t.rejects(
            client.build('notes', variationsFor(client)),
            /no parser is configured/,
            'the bundle request is rejected with the real reason'
        );
        t.equal(uncaught, null, 'nothing escapes as an uncaught exception');
    }
);
