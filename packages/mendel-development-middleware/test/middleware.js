const tap = require('tap');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { Writable } = require('stream');
const { stageFixture } = require('../../mendel-pipeline/test/helpers');

// Shared with mendel-pipeline's error-handling test; sources are mutated, so
// the fixture is copied into this package's own run directory.
const appPath = stageFixture(
    path.resolve(
        __dirname,
        '../../mendel-pipeline/test/fixtures/error-project'
    ),
    'middleware',
    { copy: true, runRoot: __dirname }
);
const helperFile = path.join(appPath, 'app/helper.js');
const mendelrcPath = path.join(appPath, '.mendelrc');
// Unix socket paths are capped near 104 bytes; a path under the fixture would
// silently truncate on a deep checkout.
const ipcPath = path.join(os.tmpdir(), `mendel-mw-${process.pid}.sock`);
process.env.MENDEL_IPC = ipcPath;

const monorepoPackages = path.resolve(__dirname, '../..');
const cliPath = path.join(monorepoPackages, 'mendel-pipeline/src/cli.js');
const browserPack = path.join(monorepoPackages, 'mendel-outlet-browser-pack');
const throwingTransform = path.join(appPath, 'throwing-transform.js');

tap.setTimeout(180000);

const GOOD_SOURCE = fs.readFileSync(helperFile, 'utf8');
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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeout = 40000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await predicate()) return true;
        await sleep(200);
    }
    return false;
}

// Minimal express-shaped response. The middleware is written against express;
// only header/status/send and being a writable stream are on the bundle path.
class FakeResponse extends Writable {
    constructor() {
        super();
        this.headers = {};
        this.body = '';
        this.statusCode = 200;
    }
    _write(chunk, encoding, callback) {
        this.body += chunk.toString();
        callback();
    }
    header(name, value) {
        this.headers[name] = value;
        return this;
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    send(body) {
        this.write(body);
        return this;
    }
}

function serve(middleware, { accept = '*/*' } = {}) {
    return new Promise((resolve, reject) => {
        const req = { url: '/mendel/base/main.js', headers: { accept } };
        const res = new FakeResponse();
        res.on('finish', () => resolve({ req, res }));
        res.on('error', reject);
        middleware(req, res, () => resolve({ req, res, passedThrough: true }));
    });
}

/**
 * Functional: the development middleware must serve the error page for every
 * bundle request while a build error is live, must not claim SSR readiness
 * against a registry missing the broken module, and must recover on its own.
 */
tap.test('middleware serves build errors and recovers', async (t) => {
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

    const prevCwd = process.cwd();
    t.teardown(() => {
        process.chdir(prevCwd);
        daemon.kill('SIGKILL');
        fs.writeFileSync(helperFile, GOOD_SOURCE);
        [mendelrcPath, ipcPath].forEach((file) => {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                /* already gone */
            }
        });
        // The middleware owns its Mendel client and never hands it back, so
        // nothing here can close the socket that keeps this process alive.
        setTimeout(() => process.exit(t.passing() ? 0 : 1), 100);
    });

    t.ok(await waitFor(() => fs.existsSync(ipcPath)), 'builder is up');

    process.chdir(appPath);
    const MendelMiddleware = require('../index');
    const middleware = MendelMiddleware({
        environment: 'development',
        verbose: false,
    });

    const healthy = await serve(middleware);
    t.equal(
        healthy.res.headers['content-type'],
        'application/javascript',
        'javascript requests get a javascript content type'
    );
    t.match(healthy.res.body, /hello/, 'a healthy build is served');
    t.ok(healthy.req.mendel.isSsrReady(), 'a healthy build is ready for SSR');

    fs.writeFileSync(helperFile, BAD_SOURCE);
    t.ok(
        await waitFor(async () => {
            const attempt = await serve(middleware);
            return /\[Mendel Build Error\]/.test(attempt.res.body);
        }, 40000),
        'requests start answering with the error bundle'
    );

    const errored = await serve(middleware);
    t.match(
        errored.res.body,
        /helper\.js/,
        'the error bundle names the broken file'
    );
    t.notOk(
        errored.req.mendel.isSsrReady(),
        'SSR is not advertised while the registry is missing a module'
    );

    const erroredCSS = await serve(middleware, {
        accept: 'text/css,*/*;q=0.1',
    });
    t.equal(
        erroredCSS.res.headers['content-type'],
        'text/css',
        'stylesheet requests keep their content type'
    );
    t.match(
        erroredCSS.res.body,
        /^\/\* \[Mendel\] Build Error/,
        'stylesheet requests get a stylesheet-safe error bundle'
    );

    fs.writeFileSync(helperFile, GOOD_SOURCE);
    t.ok(
        await waitFor(async () => {
            const attempt = await serve(middleware);
            return /hello/.test(attempt.res.body);
        }, 40000),
        'the real bundle comes back once the file is fixed'
    );
});
