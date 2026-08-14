const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { stageFixture } = require('../../mendel-pipeline/test/helpers');

// Shared with mendel-pipeline's error-handling test; sources are mutated, so
// the fixture is copied into this package's own run directory.
const appPath = stageFixture(
    path.resolve(
        __dirname,
        '../../mendel-pipeline/test/fixtures/error-project'
    ),
    'karma-mendel',
    { copy: true, runRoot: __dirname }
);
const helperFile = path.join(appPath, 'app/helper.js');
const mainFile = path.join(appPath, 'app/main.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
// Unix socket paths are capped near 104 bytes; a path under the fixture would
// silently truncate on a deep checkout.
const ipcPath = path.join(os.tmpdir(), `mendel-km-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;

const monorepoPackages = path.resolve(__dirname, '../..');
const cliPath = path.join(monorepoPackages, 'mendel-pipeline/src/cli.js');
const browserPack = path.join(monorepoPackages, 'mendel-outlet-browser-pack');
const throwingTransform = path.join(appPath, 'throwing-transform.js');
const MENDEL_GLOBAL_PATH = '/tmp/mendel-global.js';

tap.setTimeout(180000);

const GOOD_SOURCE = fs.readFileSync(helperFile, 'utf8');
const BAD_SOURCE = GOOD_SOURCE + '\n// MENDEL_BREAK_ME\n';

// The variation of helper.js is what makes an errored build dangerous rather
// than merely incomplete: dropping the base entry leaves the variation under
// the same normalizedId, so a registry walk still finds *a* module for it.
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

function servedFiles() {
    return [
        { originalPath: MENDEL_GLOBAL_PATH },
        { originalPath: mainFile },
        { originalPath: helperFile },
    ];
}

/**
 * Functional regression: karma reads mendel's registry directly instead of
 * going through client.build(), so it must wait for the strict readiness
 * check. Under the loose one a build error let karma walk a registry that had
 * silently lost the broken base module while keeping its variation, and the
 * browser ran the variation's code as if it were the base test run.
 */
tap.test('karma refuses to run against an errored build', async (t) => {
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

    // The plugin keeps its client in a module-private global; capturing it
    // here is the only way to observe its sync state and to close its socket
    // at teardown.
    const BuildOnDemand = require('mendel-pipeline/client');
    const clients = [];
    const originalRun = BuildOnDemand.prototype.run;
    BuildOnDemand.prototype.run = function () {
        clients.push(this);
        return originalRun.apply(this, arguments);
    };

    t.teardown(() => {
        // run() lives on the base prototype; the patch above shadowed it.
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

    const onFileList = emitter.listeners('file_list_modified')[0];
    const karmaClient = clients[0];
    t.ok(karmaClient, 'the framework started a mendel client');

    t.ok(
        await waitFor(() => karmaClient.isRegistryComplete()),
        'karma client reaches a complete registry on a healthy build'
    );

    const healthy = { served: servedFiles(), included: [] };
    await onFileList(healthy);

    const healthyPaths = healthy.included.map((_) => _.originalPath);
    t.equal(logged.length, 0, 'a healthy build logs no error');
    t.ok(
        healthyPaths.some((_) => _ === helperFile),
        'karma is served the base module'
    );
    t.ok(
        healthyPaths.some((_) => /variations\/exp\/helper\.js$/.test(_)),
        'karma is served the variation of that module too'
    );

    fs.writeFileSync(helperFile, BAD_SOURCE);

    t.ok(
        await waitFor(
            () => karmaClient.getSyncState() === 'synced-with-errors'
        ),
        'karma client sees the build error'
    );
    t.notOk(
        karmaClient.isRegistryComplete(),
        'an errored build is not a complete registry'
    );
    t.notOk(
        karmaClient.registry.getEntry('./app/helper.js'),
        'the broken base module is gone from the registry'
    );
    t.ok(
        karmaClient.registry.getEntry('./variations/exp/helper.js'),
        'its variation is still there, which is what made the walk unsafe'
    );

    const broken = { served: servedFiles(), included: [] };
    await onFileList(broken);

    t.notOk(
        broken.included.some((_) =>
            /variations\/exp\/helper\.js$/.test(_.originalPath)
        ),
        'the variation is not served in place of the broken base module'
    );
    t.equal(broken.included.length, 0, 'karma is given no module list to run');
    t.equal(logged.length, 1, 'the build failure is reported to karma');
    t.match(
        String(logged[0]),
        /helper\.js/,
        'the reported error names the file that broke'
    );

    const preprocessorLogged = [];
    const getFile = plugin['preprocessor:mendel'][1](
        makeLogger(preprocessorLogged)
    );
    const preprocessed = await new Promise((resolve) => {
        getFile(
            fs.readFileSync(mainFile, 'utf8'),
            { originalPath: mainFile },
            (error, content) => resolve({ error, content })
        );
    });

    t.ok(
        preprocessed.error instanceof Error,
        'the preprocessor errors out instead of serving the file'
    );
    t.match(
        preprocessed.error.message,
        /helper\.js/,
        'the preprocessor error names the file that broke'
    );

    fs.writeFileSync(helperFile, GOOD_SOURCE);
    t.ok(
        await waitFor(() => karmaClient.isRegistryComplete()),
        'fixing the file returns the registry to complete'
    );

    const recovered = { served: servedFiles(), included: [] };
    await onFileList(recovered);
    t.ok(
        recovered.included.some((_) => _.originalPath === helperFile),
        'karma runs again once the build is healthy'
    );
    t.equal(logged.length, 1, 'recovery logs no further error');
});
