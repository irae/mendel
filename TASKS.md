# TASKS: Drop small dependencies with native Node equivalents

## 1. uuid → crypto.randomUUID()

- [ ] `examples/planout-example/app.js`
    - [ ] Replace `require('uuid')` with `crypto.randomUUID()`
    - [ ] Remove from package.json
    - [ ] Test

## 2. xtend → Object.assign / spread

- [x] `packages/mendel-core/tree-variation-walker.js`
- [x] `packages/mendel-core/tree-hash-walker.js`
- [x] `packages/mendel-config/index.js`
- [x] `packages/mendel-config/legacy/index.js`
    - [x] Remove from both package.jsons
    - [x] Test mendel-core
    - [x] Test mendel-config

## 3. urlsafe-base64 → Buffer native base64url

- [x] `packages/mendel-core/tree-serialiser.js`
- [x] `packages/mendel-core/tree-deserialiser.js`
    - [x] Remove from mendel-core package.json
    - [x] Test mendel-core

## 4. rimraf → fs.rmSync

- [x] `packages/mendel-transform-less/test/outlet-css.js`
- [x] `packages/mendel-pipeline/test/helpers/index.js`
    - [x] Remove from both package.jsons
    - [x] Test mendel-transform-less
    - [x] Test mendel-pipeline (integration tests timeout under resource pressure, unit tests pass)

## 5. glob → fs.globSync / fs.promises.glob

- [x] `packages/mendel-mocha-runner/index.js`
- [x] `packages/mendel-development/apply-extra-options.js`
- [x] `packages/mendel-deps/test/js.js`
- [x] `packages/mendel-deps/test/edge-case1.js`
- [x] `packages/mendel-deps/test/css.js`
    - [x] Remove from package.jsons
    - [x] Test mendel-mocha-runner (no tests)
    - [x] Test mendel-development
    - [x] Test mendel-deps

## 6. chalk → util.styleText

- [x] `packages/mendel-pipeline/src/main.js`
- [x] `packages/mendel-pipeline/src/cli.js`
- [x] `packages/mendel-pipeline/src/cache/network/unix-socket.js`
- [x] `packages/mendel-pipeline/src/helpers/analytics/cli-printer.js`
- [x] `packages/mendel-pipeline/src/cache/client.js`
- [x] `packages/mendel-pipeline/src/pipeline.js`
    - [x] Remove from mendel-pipeline package.json
    - [x] Test mendel-pipeline (unit tests pass, integration tests timeout under resource pressure)

## 7. tmp → fs.mkdtempSync

- [ ] `packages/mendel-manifest-extract-bundles/test/manifest-extract.js`
- [ ] `packages/mendel-development/test/post-process-manifest.js`
- [ ] `packages/mendel-development/validate-manifest.js`
- [ ] `packages/mendel-manifest-uglify/test/manifest-uglify.js`
    - [ ] Remove from package.jsons
    - [ ] Test mendel-manifest-extract-bundles
    - [ ] Test mendel-development
    - [ ] Test mendel-manifest-uglify

## 8. shasum → crypto.createHash('sha1')

- [ ] `packages/mendel-development/mendelify-transform-stream.js`
- [ ] `packages/mendel-outlet-manifest/src/index.js`
    - [ ] Remove from package.jsons
    - [ ] Test mendel-development
    - [ ] Test mendel-outlet-manifest
