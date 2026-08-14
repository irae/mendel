const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const karma = require('karma');
const { stageFixture } = require('../../mendel-pipeline/test/helpers');

// Sources are mutated, so the shared fixture is copied into this package's own
// run directory, under a run name of its own so it never races errored-build.
const appPath = stageFixture(
    path.resolve(
        __dirname,
        '../../mendel-pipeline/test/fixtures/error-project'
    ),
    'karma-mendel-watch',
    { copy: true, runRoot: __dirname }
);
const helperFile = path.join(appPath, 'app/helper.js');
const mainFile = path.join(appPath, 'app/main.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
// Unix socket paths are capped near 104 bytes; a path under the fixture would
// silently truncate on a deep checkout.
const ipcPath = path.join(os.tmpdir(), `mendel-kmw-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;

const monorepoPackages = path.resolve(__dirname, '../..');
const cliPath = path.join(monorepoPackages, 'mendel-pipeline/src/cli.js');
const browserPack = path.join(monorepoPackages, 'mendel-outlet-browser-pack');
const throwingTransform = path.join(appPath, 'throwing-transform.js');

tap.setTimeout(240000);

const GOOD_SOURCE = fs.readFileSync(helperFile, 'utf8');
const BAD_SOURCE = GOOD_SOURCE + '\n// MENDEL_BREAK_ME\n';

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

async function waitFor(predicate, timeout = 60000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await sleep(200);
    }
    return false;
}

function servedContent(server, originalPath) {
    const file = server
        .get('fileList')
        .files.served.find((_) => _.originalPath === originalPath);
    return (file && file.content) || '';
}

/**
 * Functional regression, watch mode. karma reaches the mendel preprocessor
 * from its own file watcher, which calls `fileList.changeFile()` without ever
 * attaching a rejection handler; karma's server converts any unhandled
 * rejection into `_close(1)`. Failing the preprocess on a build error
 * therefore terminated the karma process (and, in a Procfile setup, every
 * sibling process with it) instead of just holding the test run. karma has to
 * survive the broken build and pick the tests back up when the file is fixed,
 * within one continuous process.
 */
tap.test(
    'karma survives a build error and recovers in watch mode',
    async (t) => {
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

        let server;
        let onKarmaExit;
        const exitCodes = [];
        const karmaExited = new Promise((resolve) => (onKarmaExit = resolve));

        // The plugin keeps its client in a module-private global; capturing it here
        // is the only way to observe its sync state and to close its socket at
        // teardown.
        const BuildOnDemand = require('mendel-pipeline/client');
        const clients = [];
        const originalRun = BuildOnDemand.prototype.run;
        BuildOnDemand.prototype.run = function () {
            clients.push(this);
            return originalRun.apply(this, arguments);
        };

        t.teardown(async () => {
            // run() lives on the base prototype; the patch above shadowed it.
            delete BuildOnDemand.prototype.run;
            if (server) {
                server._close(0);
                await Promise.race([karmaExited, sleep(15000)]);
            }
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

        const config = await karma.config.parseConfig(
            null,
            {
                basePath: appPath,
                frameworks: ['mendel'],
                plugins: [require('../lib/plugin')],
                files: [path.join(appPath, 'app/*.js')],
                preprocessors: { [path.join(appPath, 'app/*.js')]: ['mendel'] },
                reporters: [],
                browsers: [],
                autoWatch: true,
                singleRun: false,
                logLevel: 'OFF',
                port: 9977,
                mendel: { environment: 'development', verbose: false },
            },
            { promiseConfig: true, throwErrors: true }
        );

        // karma's `done` is `process.exit` unless a callback is given; capturing it
        // is what makes "the process would have died" observable from a test.
        server = new karma.Server(config, (code) => {
            exitCodes.push(code);
            onKarmaExit();
        });

        const listening = new Promise((resolve) =>
            server.once('listening', resolve)
        );
        server.start();
        await listening;

        t.ok(
            await waitFor(() =>
                servedContent(server, helperFile).includes('__mendel_module__')
            ),
            'karma serves the mendel-wrapped base module on a healthy build'
        );
        t.match(
            servedContent(server, helperFile),
            /hello /,
            'the served module is the base file, not its variation'
        );
        t.same(exitCodes, [], 'karma is still running');

        // Exactly what karma's own watcher does on a change: no rejection handler.
        fs.writeFileSync(helperFile, BAD_SOURCE);
        const changeSettled = [];
        server
            .get('fileList')
            .changeFile(helperFile, true)
            .then(
                () => changeSettled.push('resolved'),
                (e) => changeSettled.push(e)
            );

        const karmaClient = clients[0];
        t.ok(karmaClient, 'the framework started a mendel client');
        t.ok(
            await waitFor(
                () => karmaClient.getSyncState() === 'synced-with-errors'
            ),
            'the daemon reports the build error to karma'
        );
        await sleep(2000);

        t.same(
            exitCodes,
            [],
            'a build error does not terminate the karma process'
        );
        t.same(
            changeSettled,
            [],
            'the watcher path holds instead of rejecting into karma'
        );
        t.notMatch(
            servedContent(server, helperFile),
            /HELLO_FROM_VARIATION/,
            'the variation is never served in place of the broken base module'
        );

        fs.writeFileSync(helperFile, GOOD_SOURCE);

        t.ok(
            await waitFor(() => changeSettled.includes('resolved')),
            'the held change completes once the build is fixed'
        );
        t.ok(
            await waitFor(() =>
                servedContent(server, helperFile).includes('__mendel_module__')
            ),
            'karma serves the mendel-wrapped base module again, with no restart'
        );
        t.match(
            servedContent(server, mainFile),
            /__mendel_module__/,
            'the rest of the test files are still wrapped and runnable'
        );
        t.same(exitCodes, [], 'karma never exited across the whole cycle');
    }
);
