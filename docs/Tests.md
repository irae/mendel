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

**Fixtures are read-only.** A test that runs a real build must copy the fixture
to a temp directory first and build there, so that generated `.mendelrc`,
`.mendelipc` and `build/` never land in the repository and two tests can share
one fixture without racing each other.

**Conventions.** Name the directory `test/fixtures/`, name the fixture after its
intent rather than a number, and give each fixture root a `README.md` stating
the invariant it exists for, which tests consume it, and — for stub npm
packages — which real package and version its shape mirrors. See
`packages/mendel-resolver/test/fixtures/imports/README.md`.

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
