const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { stageFixture } = require('../../mendel-pipeline/test/helpers');

// Shared with mendel-pipeline's error-handling test; sources are mutated, so
// the fixture is copied into this package's own run directory.
const appPath = stageFixture(
    path.resolve(
        __dirname,
        '../../mendel-pipeline/test/fixtures/error-project'
    ),
    'karma-mendel-preprocessor',
    { copy: true, runRoot: __dirname }
);
const helperFile = path.join(appPath, 'app/helper.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
const ipcPath = path.join(os.tmpdir(), `mendel-kmp-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;

const monorepoPackages = path.resolve(__dirname, '../..');
const cliPath = path.join(monorepoPackages, 'mendel-pipeline/src/cli.js');
const browserPack = path.join(monorepoPackages, 'mendel-outlet-browser-pack');
const throwingTransform = path.join(appPath, 'throwing-transform.js');

tap.setTimeout(180000);

const GOOD_SOURCE = fs.readFileSync(helperFile, 'utf8');

const YAML = `base-config:
  id: base
  dir: ./app
  outdir: ./build

variation-config:
  variation-dirs:
    - ./variations
  variations:
    exp:

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeout = 40000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await sleep(200);
    }
    return false;
}

function makeLogger(errors) {
    const noop = () => {};
    return {
        create: () => ({
            info: noop,
            debug: noop,
            warn: noop,
            error: (e) => errors.push(e),
        }),
    };
}

/**
 * Functional regression: preprocessor handles throws in its post-gate body.
 * The gate (waitForCompleteRegistry) has its own try/catch, but the registry
 * read and wrapMendelModule call afterward can also throw — on malformed
 * sourcemap (`new SourceMapConsumer(module.map)`) or unexpected entry shape.
 * An unhandled rejection from the async getFile would turn into an unhandled
 * rejection that karma's server converts to `_close(1)`, terminating the
 * process. This test verifies those throws route to `done(error, null)`
 * instead by injecting a module with malformed sourcemap into the registry.
 */
tap.test('preprocessor catches throws after the readiness gate', async (t) => {
    fs.writeFileSync(mendelrcPath, YAML);
    fs.writeFileSync(helperFile, GOOD_SOURCE);
    try {
        fs.unlinkSync(ipcPath);
    } catch (e) {
        /* no socket yet */
    }

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

    // mendel-config defaults projectRoot to process.cwd().
    const prevCwd = process.cwd();
    process.chdir(appPath);

    const BuildOnDemand = require('mendel-pipeline/client');
    const clients = [];
    const originalRun = BuildOnDemand.prototype.run;
    BuildOnDemand.prototype.run = function () {
        clients.push(this);
        return originalRun.apply(this, arguments);
    };

    t.teardown(() => {
        delete BuildOnDemand.prototype.run;
        clients.forEach((client) => client.exit());
        daemon.kill('SIGKILL');
        process.chdir(prevCwd);
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

    const plugin = require('../lib/plugin');
    const logged = [];
    const logger = makeLogger(logged);
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    const karmaConfig = {
        mendel: { environment: 'development', verbose: false },
        files: [],
        autoWatchBatchDelay: 0,
    };

    await plugin['framework:mendel'][1](
        logger,
        emitter,
        { refresh: () => {} },
        karmaConfig
    );

    const karmaClient = clients[0];
    t.ok(karmaClient, 'the framework started a mendel client');

    t.ok(
        await waitFor(() => karmaClient.isRegistryComplete()),
        'karma client reaches a complete registry on a healthy build'
    );

    const preprocessorLogged = [];
    const getFile = plugin['preprocessor:mendel'][1](
        makeLogger(preprocessorLogged)
    );

    // Patch registry.getEntry to inject a module with malformed sourcemap that
    // will throw when wrapMendelModule tries to parse it.
    const originalGetEntry = karmaClient.registry.getEntry.bind(
        karmaClient.registry
    );
    karmaClient.registry.getEntry = function (path) {
        const module = originalGetEntry(path);
        if (module && path === './app/helper.js') {
            // Inject an invalid sourcemap (unparseable JSON) that will throw
            // during SourceMapConsumer parsing in wrapMendelModule. This is what
            // the fix protects against.
            return Object.assign({}, module, {
                map: 'not-valid-json{{{', // Will fail to parse
            });
        }
        return module;
    };

    // Call the preprocessor on the helper file
    const preprocessed = await new Promise((resolve) => {
        getFile(
            fs.readFileSync(helperFile, 'utf8'),
            { originalPath: helperFile },
            (error, content) => resolve({ error, content })
        );
    });

    t.ok(
        preprocessed.error instanceof Error,
        'preprocessor catches the sourcemap error and passes it to done'
    );
    t.notOk(preprocessed.content, 'no content is passed when an error occurs');
    t.ok(
        preprocessorLogged.length > 0,
        'the error is logged by the preprocessor'
    );
});
