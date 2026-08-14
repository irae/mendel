## Mendel Tests

For the moment, Mendel relies on some private repositories for integration tests. Make sure you have the appropriate access in order to run integration tests.

### Unit tests

**File organization:**

- All tests are in the test/ directory
- Each test files corresponds to exactly one source file
- Only stubs and fixtures use subdirectories
- All build/ directories are ignored via the .gitignore to prevent generated output from being committed

#### Test fixtures

Mendel is a bundler, so most tests need a small project on disk rather than a
mock. Prefer **few, realistically shaped fixtures** over one fixture per
assertion: a fixture that combines several related shapes the way a real
application would covers more surface and stays recognisable to a human reader.
`examples/full-example` is the reference for what "realistic" means.

**Where a fixture lives.** There are three kinds:

- **Project fixture** — a tree with a `.mendelrc`: base dir, variation dirs,
  `node_modules/`. Lives in `test/fixtures/<name>/` of the _lowest_ package in
  the dependency graph that needs it (`mendel-config` → `mendel-deps` →
  `mendel-resolver` → `mendel-pipeline` → outlets). Packages above it in the
  graph reuse it by relative path instead of copying it; the reverse direction
  is not allowed.
- **Package-shape catalog** — a `node_modules/`-only tree of stub packages
  mirroring real npm packages to exercise one resolution algorithm (`exports`,
  `imports`, legacy `browser`/`main` fields). Lives in `mendel-resolver`, shared.
- **Unit input** — a single file or two fed straight to one module: manifest
  JSON snapshots, parser inputs, config-parsing inputs. Package-local, never
  shared.

Rule of thumb: if it has a root `.mendelrc` or `package.json`, it is shared; if
it is the input to exactly one module's parse or serialize step, it is local.

Fixtures never ship — every package uses a `files` whitelist in its
`package.json` — so a cross-package fixture read costs nothing at publish time.

**Fixtures are read-only.** A test that runs a real build stages it first, with
`stageFixture()` from `packages/mendel-pipeline/test/helpers`:

```js
const { stageFixture, runBuild, baseYaml } = require('./helpers');
const appPath = stageFixture(
    path.resolve(__dirname, './fixtures/parser-project'),
    'parser-coverage-missing'
);
```

That builds `test/.mendel-runs/<run name>/`, which is gitignored and looks like
a project root: one symlink per top-level child of the fixture, and real,
writable `.mendelrc`, `.mendelipc` and `build/` alongside them. Generated output
therefore never lands in the repository, several tests can share one fixture
without racing, and — unlike a temp directory — the output stays at a short
relative path you can `cat` after a failure.

Three things to know:

- Each child of the fixture is linked separately, never the fixture root, because
  `node_modules` is found by walking up from the requiring file to the project
  root. Linking only `app/` would make that walk land in the run directory.
- A fixture's dependencies live in `stubs/` and are staged as `node_modules/`;
  a directory actually named `node_modules` cannot be committed.
- Tests that mutate their sources — breaking a file to watch the build recover —
  pass `{ copy: true }` so the mutation lands in the run directory. Never write
  through a link into a fixture.

Another package's fixture is staged the same way, passing `runRoot: __dirname`
so the output stays under the consuming package. See
`packages/mendel-development-middleware/test/middleware.js`, which stages a
`mendel-pipeline` fixture.

**Conventions.** Name the directory `test/fixtures/`, name the fixture after its
intent rather than a number, and give each fixture root a `README.md` stating
the invariant it exists for, which tests consume it, and — for stub npm
packages — which real package and version its shape mirrors. See
`packages/mendel-resolver/test/fixtures/imports/README.md`. Where one fixture
backs several assertions, keep expectations in `expect/<case>.json` and drive
them from a case table; `packages/mendel-resolver/test/all.js` does this.

#### End-to-end daemon and client harness

Some behaviour only exists between two processes: daemon lifecycle, watch-mode
recovery, error propagation from a transform to a bundle, client sync state,
one-shot exit codes. None of it is reachable from a unit test of a single
package — the pipeline, the IPC socket and the client registry all have to be
real. For anything narrower (a resolver algorithm, a config key, a parser),
stay in the package's own `test/` directory instead.

The harness is a real builder spawned as a child process over a **scratch
socket**, plus a real client driven the way
`packages/mendel-development-middleware/index.js` drives it in a dev server:
`BuildOnDemand` with `noout: true`, `resolveVariations()`, then
`client.build(bundleId, variations)`.

Use `examples/full-example` as the target project. It is a real React/JSX app
whose `.mendelrc` deliberately keeps the awkward cases alive: four variations
with an inheritance chain (`bucket_D` → `partner_C`) and a variation pointing at
a directory that does not exist, babel + uglify + istanbul transforms, a JSON
parser with type conversion (`json` → `js`), CSS and RTL-CSS outlets, both
generators (`extract-bundles`, `node-modules`), a `browser`-field dual package
under `components/about/`, a lazy-loaded bundle, server-side render and manifest
outlets in the `production` env, and a `test` env with its own type map. A build
that survives it has touched most of the pipeline.

```js
const ipcPath = path.join(os.tmpdir(), `mendel-probe-${process.pid}.sock`);
const appPath = path.resolve(__dirname, '../../../examples/full-example');

const daemon = spawn(process.execPath, [cliPath, '--watch'], {
    cwd: appPath,
    env: Object.assign({}, process.env, {
        MENDEL_IPC: ipcPath,
        MENDEL_ENV: 'development',
        NODE_ENV: 'development',
    }),
    stdio: ['ignore', 'ignore', 'pipe'],
});
// The daemon reports transform failures on stderr; capture it to assert on.
daemon.stderr.on('data', (d) => (stderr += d));
await waitFor(() => fs.existsSync(ipcPath)); // builder is up

// mendel-config defaults projectRoot to process.cwd()
process.chdir(appPath);
const BuildOnDemand = require('mendel-pipeline/client');
const client = new BuildOnDemand({
    environment: 'development',
    noout: true,
    verbose: false,
});
client.run();

await waitFor(() => client.isSynced());
const vars = resolveVariations(client.config.variationConfig.variations, [
    'bucket_A',
]);
const output = await client.build('main', vars); // string or Stream

// ... mutate a source file, then watch the client leave and re-enter sync ...

client.exit();
daemon.kill('SIGKILL');
fs.unlinkSync(ipcPath);
```

Notes that cost time to rediscover:

- **Always a scratch socket.** `MENDEL_IPC` defaults to `.mendelipc` in the
  project root, so a test that uses the default silently attaches to whatever
  builder the developer already has running. Put the scratch socket in
  `os.tmpdir()`: unix socket paths cap out near 104 bytes and a path inside a
  deep checkout truncates without an error.
- **State to poll**, since there is no single "done" callback: `client.isSynced()`
  (`false` from the first file change until the pipeline goes idle again), and
  the `ready` / `change` events the client re-emits from the cache client's
  `sync` / `unsync`. Poll on an interval with a deadline; a full-example build
  is tens of seconds, so raise the test timeout well past tap's default.
- **`build()` resolves to a string or a Stream** depending on the outlet — drain
  it before asserting on bundle contents.
- **One-shot mode** (`mendel` with no `--watch`) is the other half: it exits `1`
  when any entry fails to transform and `0` on a clean build, verified by
  running `packages/mendel-pipeline/src/cli.js` with `cwd` set to the project.
- **Restore what you break.** Rewrite the mutated source, kill the daemon and
  unlink the socket in a `teardown`, and also from a `process.on('exit')` guard
  so an aborted run does not leave a broken file in the working tree.

See also `packages/mendel-pipeline/test/error-handling.js` — landing with the
daemon error-handling work — for this pattern as an automated test rather than
an ad hoc probe.

#### Event-order bugs

Some bugs are not visible from inspecting state at any single point in time —
the state is fine in isolation, but nothing gets triggered by what should
happen _after_ it. They only reproduce by actually driving the real sequence
of async events in order: a state-only assertion (call a function, check the
result) cannot see them, because the bug is in what's missing between two
events, not in either event alone.

Concrete example: `packages/mendel-pipeline/src/cache/client.js`'s `synced`
flag used to be cleared on `removeEntry` but only ever re-set from `addEntry`'s
`checkStatus()` call. Deleting a file the daemon watches sends a `removeEntry`
with no `addEntry` ever following it, so nothing re-checked status again — the
client stayed `unsynced` forever, and every subsequent bundle request hung
with no response until an unrelated file happened to change. Nothing about
this was visible from a unit test of `checkStatus()` or `removeEntry()` alone;
both behave exactly as coded. It only shows up by actually deleting a file in
a running daemon+client and watching what does (and doesn't) happen next. See
`packages/mendel-pipeline/test/delete-unsync.js`.

The prevention pattern is a genuine **red-green functional test**: reproduce
the event sequence for real — real daemon, real file operations, real timing —
and confirm the test _fails_ on the unfixed code before trusting that it
passing on the fixed code means anything. A test that only checks "is the code
shaped correctly" misses this class of bug entirely; a poll-based assertion
can miss it too if the race it's checking for resolves faster than the poll's
first tick, so prefer waiting on the actual event (`client.once('change', …)`)
over sampling state on an interval when the thing being proven is "did this
transition happen at all."

#### Running tests.

If you develop against a consumer app, link packages with the pnpm flow in
[DEVELOPMENT.md](../DEVELOPMENT.md) (`pnpm run link:global` in this repo).

To run tests quickly, please use:

    npm test     # all tests
    npm run unit # only unit tests
    npm run lint # only linter

If you want a quick coverage report of files and classes we already wrote tests, you can run:

    npm run coverage

This will run coverage with command line output only and will only cover files that are required by tests. To run full coverage you can:

    npm run coverage-html

This will find all files in the application and report coverage in both the command line and HTML formats. If possible, it will as open your browser to view the report.

To run tests against a single file you can:

    npm run unit-file test/testname.js

#### Single file coverage

We avoid mocking too much, so coverage might be biased when running the full suite. To make sure coverage is 100% on each file, you can run coverage on a single test file, but listing all files that were covered:

    npm run coverage-file test/testname.js

Tests are written to target a single file, so when running the single test file, look for the corresponding source file, even though many files may show up in the result.

Finally, if you want to find out if your changes are impacting those individual files coverage, there is a helper to loop through each test file running coverage and outputting summary to the terminal.

    npm run coverage-all-individualy
