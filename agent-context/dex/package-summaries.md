# Package Summaries

## Core Infrastructure

### mendel-pipeline

**Main entry**: `src/main.js` | **CLI**: `src/cli.js`

The top-level orchestrator. Exports two classes:

-   `MendelPipelineDaemon`: runs the build daemon. Creates caches, starts file watcher, spawns transform/dep worker pools, and hosts the Unix socket server.
-   `MendelClient` (via `client/build-all.js` or `client/build-ondemand.js`): connects to the daemon, receives built entries, runs generators and outlets.

Also exports `mendel-pipeline/client` — a standalone client for use by middleware.

Contains all internal sub-systems: `MendelCache`, `MendelRegistry`, `FsWatcher`, `CacheServer`, `CacheClient`, `TransformManager`, `DepsManager`, pipeline steps (Initialize, FileReader, IST, Waiter, GST, End), generators runner, outlets runner.

---

### mendel-config

**Main entry**: `index.js`

Configuration parser and normalizer. Reads `.mendelrc` (YAML) or `package.json#mendel` by walking up the directory tree. Returns a fully normalized config object with typed sub-configs:

-   `VariationConfig`: normalizes variation directories and chains
-   `BundleConfig`: normalizes bundle entries, generator, outlet assignments
-   `TransformConfig`: resolves plugin paths, modes (ist/gst), options
-   `TypesConfig`: maps file globs to type names with transform lists
-   `OutletConfig`, `GeneratorConfig`, `PostGeneratorConfig`
-   `ShimConfig`: merges user shims with node-libs-browser defaults

Has a legacy branch (`legacy.js`) for v1 config format (ES5-only, pre-`base-config` key).

---

### mendel-deps

**Main entry**: `src/index.js`

AST-based dependency detector. Given a file path and source string, extracts all `require()` / `import` literals. Supports:

-   JavaScript/JSX/TypeScript (via `@babel/parser` + `@babel/traverse`)
-   CSS `@import` statements (via `css` package)

Returns `{ imports: string[], exports: [] }`. Does not resolve paths; that is delegated to `mendel-resolver` by the caller.

---

### mendel-resolver

**Main entry**: `index.js`

Promise-based module resolver that handles all Node.js resolution rules plus browser-field overrides from `package.json`. Resolves a module name to an object with `main`, `browser`, and `module` runtime slots. Each slot points to the appropriate file path for that runtime.

Handles:

-   Relative paths (with extension probing)
-   Directory resolution (`index.js` fallback, `package.json` main)
-   `node_modules` resolution (walks ancestor directories)
-   `package.json` `browser` field as string or object (path remapping)
-   `unpkg` / `exports.umd` fallback for packages without separate browser builds

---

### mendel-development

**Main entry**: none (utilities only)

Shared utility library for build and development packages. Provides:

-   `variation-matches.js`: matches a file path against variation directories
-   `debug-filter.js`: conditional debug logging with file pattern filtering
-   `resolve-variations.js`: resolves variation chains given a variation config
-   `mendelify-require-transform.js` / `mendelify-transform-stream.js`: stream transforms for rewriting `require` paths in source
-   `proxy.js`: creates limited-API proxy objects (used by GST for entry proxies)
-   `post-process-manifest.js`, `sort-manifest.js`, `validate-manifest.js`: legacy manifest utilities

---

### mendel-core

**Main entry**: `trees.js`

Runtime manifest reader for production bundle serving. Reads pre-built JSON manifests and provides:

-   `findTreeForVariations(bundle, lookupChains)`: given variation lookup chains, selects the correct file variant for each module via `MendelVariationWalker`
-   `findTreeForHash(bundle, hash)`: decodes a URL hash and returns the matching bundle tree — used by `mendel-middleware` to serve cached bundles
-   `variationsAndChains(lookFor)`: converts a variation ID list into chain arrays for tree walking
-   `findServerVariationMap`: builds SSR variation map for `mendel-loader`

The manifest format (`indexes` + `bundles` array) is the v1 format written by `mendel-outlet-manifest`.

---

## Middleware and Runtime

### mendel-middleware

**Main entry**: `index.js`

Express middleware for production bundle serving. Attaches to `req.mendel`:

-   `setVariations(variations)`: records experiment assignments for the request
-   `getURL(bundleId)`: returns the cache-busting bundle URL for a given variation set
-   `getBundle(bundleId)`: resolves the variation tree for bundle serving
-   `resolver()`: returns a `MendelLoader`-backed require function for SSR

Matches the route `/mendel/:hash/:bundle.js`, locates the tree via hash, compresses dependency IDs to numeric indexes, and streams through `browser-pack`.

---

### mendel-development-middleware

**Main entry**: `index.js`

Express middleware for development (no pre-built manifests). Connects a `MendelClient` (pipeline client) to the running daemon, receives live entries. Attaches the same `req.mendel` API as production middleware, but:

-   `resolver()` uses `mendel-exec` (vm-based execution) for SSR, not file-based `mendel-loader`
-   Bundle routes use `/mendel/:variations/:bundle` (variation names in URL, not hash)
-   Bundles are assembled live from registry state

---

### mendel-loader

**Main entry**: `loader.js`

Server-side require hook for production SSR. Given a `MendelTrees` instance and a variation map, creates a `MendelResolver` that remaps `require()` calls to the correct variation's output file. Used by `mendel-middleware` in production after SSR files are written by `mendel-outlet-server-side-render`.

---

### mendel-exec

**Main entry**: `index.js`

JavaScript executor using Node.js `vm.runInContext`. Used by development middleware for SSR without pre-built files. Given a registry and variation configuration, executes modules in a sandboxed context with a custom `require` that resolves modules through the registry's variation map. Handles:

-   CommonJS module wrapping (`module.exports`, `require`, `__filename`, `__dirname`)
-   Cycle detection via require cache
-   Source map error remapping
-   Built-in module pass-through

---

## Generators

### mendel-generator-extract

**Main entry**: `generator-extract.js`

Code-splitting generator. Extracts a subset of entries from a parent bundle into a separate lazy-loaded bundle. Algorithm:

1. Walks dependencies of the lazy entry points
2. Walks dependencies of the main bundle entries (excluding lazy paths)
3. Modules present in both: stay in main, exposed for lazy to `require()`
4. Modules only in lazy: move to lazy bundle, unexposed (internal)

---

### mendel-generator-node-modules

**Main entry**: `generator-node-modules.js`

Vendor bundle generator. Moves all `node_modules` entries from specified source bundles into a dedicated vendor bundle. Exposed modules get `expose = normalizedId` so app bundles can `require()` them externally.

---

### mendel-generator-prune

**Main entry**: `index.js`

Post-generator. Cleans up dangling dependency references across a group of bundles: removes dep entries that point to modules not present in any bundle of the group, and remaps external `expose` IDs to their canonical normalized forms.

---

## Outlets

### mendel-outlet-browser-pack

**Main entry**: `src/index.js`

JavaScript bundle outlet. Groups entries by `normalizedId`, placing all variation versions of each module together. At serve time, `matchVar()` picks the correct variation based on the request's variation chain. Streams output through `browser-pack`. Handles:

-   Global shims (`process`, `global`) via IIFE wrapper
-   Inline source maps via base64 encoding
-   File output or stream return (for development middleware)

---

### mendel-outlet-manifest

**Main entry**: `src/index.js`

Writes the v1 JSON manifest. Transforms the entry map into `{ indexes: {}, bundles: [] }` format with per-entry data: `id`, `deps`, `file`, `variation`, `source`, `sha`. Optionally applies env-variable inlining (via Babel `transform-inline-environment-variables`) and UglifyJS minification before writing.

---

### mendel-outlet-server-side-render

**Main entry**: `index.js`

Extends `ManifestOutlet`. Writes the manifest JSON (for `mendel-core`) and also writes individual transformed source files to disk at `outdir/ssr-dir/variation/path`. Files can optionally have `require` paths rewritten to point to the output directory structure.

---

### mendel-outlet-css

**Main entry**: `index.js`

CSS concatenation outlet. Collects entries of type CSS and concatenates their sources in dependency order.

---

## Transforms

All transforms implement the same interface: `transform({ source, map, filename }, options)` → `{ source, map }`. They run as IST (file-level) or GST (graph-level) depending on config.

### mendel-transform-babel

Wraps `@babel/core`. Accepts any Babel config options. Primary transform for modern JavaScript.

### mendel-transform-buble

Wraps `bublé` (Rollup-era lightweight ES6 transpiler). Faster than Babel, fewer features.

### mendel-transform-inline-env

Replaces `process.env.VARNAME` references with their string values at build time.

### mendel-transform-istanbul

Instruments source with Istanbul coverage counters. Applied in test environments.

### mendel-transform-less

Compiles LESS files to CSS.

### mendel-transform-uglify

Minifies JavaScript with `uglify-es`. Can run as IST for per-file minification.

---

## Manifest Utilities

### mendel-manifest-extract-bundles

Reads multiple manifests and extracts shared dependencies from child bundles, exposing them from a parent bundle. Used in post-processing steps for code-splitting scenarios.

### mendel-manifest-uglify

Walks all manifests and applies UglifyJS to each module's source. Used by `mendel-outlet-manifest` internally.

---

## Testing and CI

### karma-mendel

Karma framework plugin. Integrates Mendel's variation-aware module loading into Karma's browser test runner, allowing tests to run against specific variations.

### mendel-mocha-runner

Mocha integration. Uses `mendel-exec` to run tests with variational module resolution, exercising different variation combinations without spinning up a server.

---

## Legacy / Compatibility

### mendel-treenherit

A Browserify transform plugin (legacy v1 integration). Rewrites `require()` calls in Browserify streams to resolve paths through the variation directory hierarchy. Predates the v2 pipeline; kept for backward compatibility with Browserify-based setups.

### mendel-requirify

Writes individual `mendel-requirified` dependency files from the Browserify pipeline. Legacy v1 artifact.

### mendel-parser-json

Wraps JSON files in a CommonJS module wrapper (`module.exports = {...}`). Allows JSON files to be `require()`d through the Mendel pipeline.
