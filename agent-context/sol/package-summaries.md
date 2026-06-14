# Package Summaries

## Core Infrastructure

### mendel-pipeline

**Main entry, CLI binary, orchestration hub.**

The central package. Contains the Mendel daemon, the build client, and all pipeline internals. Exposes a `mendel` CLI binary.

Key internal structure:

-   `src/daemon.js`: `MendelPipelineDaemon` — owns file watching, per-environment pipelines, transformer pool, deps workers, and the IPC cache server. Creates and manages one `MendelPipeline` per environment.
-   `src/pipeline.js`: `MendelPipeline` — chains the six processing steps (Initialize → FileReader → IST → Waiter → GST → End) using event-driven `done` propagation.
-   `src/cache/index.js`: `MendelCache` — the in-memory store for all processed entries, with multi-runtime dependency tracking.
-   `src/cache/server.js` / `src/cache/client.js`: IPC layer over Unix socket for daemon-to-client entry streaming.
-   `src/step/`: The six pipeline steps (see overview).
-   `src/transformer/`: Worker pool (`MultiProcessMaster`) for parallel IST transforms.
-   `src/deps/`: Worker pool for parallel dependency detection.
-   `src/registry/pipeline.js`: `MendelRegistry` — thin wrapper around `MendelCache` that pipeline steps talk to.
-   `src/registry/client.js`: `MendelOutletRegistry` — the client-side store used by generators and outlets. Includes the `walk()` and `getEntriesByGlob()` APIs used by generators.
-   `src/client/base-client.js`: Base class for client processes. Handles IPC setup and the `sync`/`unsync` lifecycle.
-   `src/client/build-all.js`: One-shot build client; runs generators and outlets after sync.
-   `src/client/build-ondemand.js`: On-demand variant, used internally.
-   `src/client/generators.js` / `outlets.js`: Orchestrators that invoke configured generator and outlet plugins.
-   `src/bundles/bundle.js`: Wraps bundle config + entry map during generator execution.

---

### mendel-config

**Configuration parser and validator.**

Reads `.mendelrc` (YAML or JSON) or `package.json` `mendel` field, merges with defaults, applies environment overrides, and returns a fully-typed configuration object. Validates that transforms referenced by types exist, that no circular parser type conversions exist, and resolves all plugin paths.

Sub-modules in `src/`:

-   `defaults.js`: Default values for all configuration keys.
-   `variation-config.js`: Expands variation directories, builds lookup chains for each variation.
-   `types-config.js`: Associates file globs to type names and their transforms/parsers.
-   `transform-config.js`: Resolves transform plugin paths and modes.
-   `bundle-config.js` / `generator-config.js` / `outlet-config.js` / `post-generator-config.js`: Typed wrappers for each section.
-   `shim-config.js`: Merges user-defined shims with the `defaultShim` set (node-libs-browser).
-   `validator.js`: Shared validation helpers.

Also has a `legacy/` directory preserving the v1 configuration format, indicating there was a migration period.

---

### mendel-development

**Shared utility library used by both build and serve paths.**

Not an application; a collection of helpers imported by many packages:

-   `variation-matches.js`: Tests whether a file path belongs to a given variation directory.
-   `debug-filter.js`: Filters debug output by file pattern to reduce noise during development.
-   `proxy.js`: Creates a restricted API proxy for entry objects passed to GST plugins.
-   `post-process-manifest.js` / `sort-manifest.js` / `validate-manifest.js`: Manifest processing utilities.
-   `require-transform.js` / `mendelify-require-transform.js` / `mendelify-transform-stream.js`: AST-level require-literal rewriting utilities (using `falafel`).
-   `resolve-variations.js`: Filesystem-level variation resolution.
-   `apply-extra-options.js`: Utility for merging plugin options.

---

### mendel-resolver

**Multi-runtime module resolver.**

A standalone, Promise-based module resolver that understands `main`, `browser`, and `module` fields in `package.json`. Unlike Node's `require.resolve`, it returns an object with per-runtime resolved paths rather than a single path. Handles:

-   Relative file resolution with extension fallback.
-   Directory resolution (falls back to `index.js` if no `package.json` main).
-   Full `browser` field remapping spec (string, object with false-valued exclusions).
-   Node module resolution (walks ancestor `node_modules` directories in order).
-   The `pkg.exports.umd` / `pkg.unpkg` fallback for packages with identical `main` and `module` fields.

Used by the deps worker pool to resolve discovered require literals into actual file paths.

---

### mendel-deps

**Dependency detection (require/import parsing).**

A small package that parses JavaScript source to extract `require()` and `import` literals without executing the code. Used by the IST step's worker pool to discover module dependencies after transformation. Exposes `isSupported(ext)` to skip binary or non-JS files.

---

## Pipeline Step Packages (used internally)

These are not standalone packages — they are modules inside `mendel-pipeline/src/step/` — but named here for clarity:

-   **Initialize**: Bridges `MendelCache.entryAdded` events into the pipeline chain.
-   **FileReader**: Reads source bytes from disk; skips virtual entries.
-   **IST** (`ist.js`): Transforms source per-file, then detects dependencies.
-   **Waiter**: Synchronization barrier before GST.
-   **GST** (`gst/index.js`): Graph-aware transforms using full dependency graph and variation permutation.
-   **End**: Marks entries done and triggers CacheServer broadcast.

---

## Generators

Generators run on the client side, walking the `MendelOutletRegistry` to populate each bundle's `entries` map before an outlet writes it.

### mendel-generator-extract

**Code splitting: extracts lazy sub-bundles from a parent bundle.**

Implements an extractify-like algorithm. Given a "lazy" bundle with specific entry points and a "from" parent bundle:

1. Walks all dependencies of the lazy entries.
2. Walks all dependencies of the parent entries (excluding the lazy entries themselves).
3. Modules only needed by lazy: removed from parent, kept private in lazy.
4. Modules shared by both: kept in parent, exposed by name; lazy bundle references them externally.

This ensures the lazy bundle does not re-bundle what the parent already shipped.

### mendel-generator-node-modules

**Vendor splitting: isolates node_modules into their own bundle.**

Filters a bundle's entries to include only those whose path contains `node_modules`. Used to create a vendor bundle that can be cached independently of application code.

### mendel-generator-prune

**Cleanup: removes dangling dependencies after other generators.**

After extract and node-modules generators mutate bundle entry sets, some entries in a bundle's dependency map may reference normalized IDs that are no longer present in the bundle (because they were moved to another bundle). Prune removes these dangling references and normalizes paths so outlets receive a clean, consistent entry set.

---

## Outlets

Outlets consume a complete bundle entry set and write output artifacts.

### mendel-outlet-browser-pack

**JavaScript bundle writer.**

Uses `browser-pack` to produce a CommonJS-compatible browser bundle. Handles:

-   Grouping entries by `normalizedId` (so all variations of a file live together in the pack JSON).
-   Picking the correct variation entry per variation chain.
-   Source map inlining via `combine-source-map`.
-   Global shims: auto-wraps bundles in an IIFE with `var global=window; var process=...` when entries reference those globals.
-   Write-to-file or return-as-stream modes.

### mendel-outlet-manifest

**Mendel v1 manifest writer.**

Serializes the processed bundle into the manifest JSON format that `mendel-core` consumes at runtime. The manifest groups all variation-specific versions of each module under one `normalizedId` entry with an `indexes` lookup map. At write time, optionally:

-   Runs env-inlining via Babel (`process.env.NODE_ENV` replacement).
-   Minifies all source via UglifyJS (`mendel-manifest-uglify`).

### mendel-outlet-server-side-render

**SSR build artifacts: per-file output + manifest.**

Extends `ManifestOutlet`. Writes a manifest (with `runtime: 'main'` deps for server-side) and also writes each individual source file to a `build/` directory with correct variation paths. This output is what `mendel-loader` / `MendelResolver` uses to intercept `require()` at runtime and redirect to the variation-specific file.

Optionally rewrites `require()` literals in the output files to point to absolute variation-specific paths, and can include source maps inline.

### mendel-outlet-css

**CSS bundle writer.**

Concatenates all CSS entries in the bundle into a single file with source maps, using PostCSS and `concat-with-sourcemaps`. Has a companion PostCSS plugin `mendel-postcss-remove-import.js` to strip `@import` directives before concatenation (since Mendel handles the concatenation itself).

### mendel-outlet-manifest (sub-role: generic serialization)

The manifest format is also used by `mendel-outlet-server-side-render` as a base class, so it serves as a general-purpose entry serializer beyond just browser manifests.

---

## Manifest Processors

These operate on completed manifest files rather than on the live registry.

### mendel-manifest-extract-bundles

**Post-build code splitting for manifests.**

Reads multiple manifest files, identifies dependencies common to a parent and a child, and restructures the manifests so common deps are exposed by the parent and the child references them. Similar purpose to `mendel-generator-extract` but operates on already-written manifest files rather than on the live in-memory entry set.

### mendel-manifest-uglify

**Minifies source inside manifest files.**

Walks all bundle entries in a manifest and runs UglifyJS on their `source` fields. Called by `mendel-outlet-manifest` at write time, but also callable standalone on any manifest file.

---

## Runtime Serving

### mendel-core

**Production runtime: manifest loading and variation resolution.**

Used in the HTTP server process (not the build process). `MendelTrees` loads all configured manifests at startup and provides:

-   `findTreeForVariations(bundleId, lookupChains)`: Resolves the exact set of modules for a variation combination using `MendelVariationWalker`.
-   `findTreeForHash(bundleId, hash)`: Reconstructs a previously-resolved tree from its content hash using `MendelHashWalker`. Used to decode inbound bundle URLs.
-   `findServerVariationMap(bundles, lookupChains)`: Produces a file path map for SSR require-interception.
-   `variationsAndChains(variationIds)`: Expands user-requested variation IDs into lookup chains.

Sub-modules:

-   `tree-walker.js`: Base depth-first module graph walker.
-   `tree-variation-walker.js`: Resolves each module to its best variation match, tracking conflicts.
-   `tree-variation-walker-server.js`: Server-side variant that returns a file path map.
-   `tree-hash-walker.js`: Reconstructs a tree from a hash.
-   `tree-serialiser.js` / `tree-deserialiser.js`: Binary serialization for compact hash storage (uses `concentrate` + `dissolve`).

### mendel-middleware

**Express middleware for production bundle serving.**

Wraps `mendel-core` and `mendel-loader`. Mounts on `req.mendel` a set of helpers:

-   `setVariations(ids)`: Called by application code to declare which experiments the current user is in.
-   `getURL(bundleId)`: Returns the content-hash URL for the variation-resolved bundle.
-   `getBundle(bundleId)`: Returns the resolved module tree.
-   `resolver(bundles, variations)`: Returns a `MendelResolver` for SSR require-interception.

When a request matches the bundle route pattern (`/mendel/:hash/:bundle.js`), the middleware decodes the hash, resolves the module tree, and streams it through `browser-pack` directly to the response. CSS bundles are written as concatenated text/css.

### mendel-loader

**Server-side require() interceptor.**

Given a `MendelTrees` instance, creates `MendelResolver` instances that intercept Node's module loading to redirect `require()` calls to variation-specific file paths. Used for isomorphic rendering: the server runs the experiment's code instead of the base code by patching the require graph.

---

## Transforms

All transforms implement a common interface: receive `(source, options)` and return `{source, map}` (for IST) or a richer API (for GST). They are loaded as plugins by the pipeline transformer worker pool or the GST step.

### mendel-transform-babel

IST transform. Runs `@babel/core.transform()` with whatever Babel config the project provides. The most commonly used transform for ES2015+ transpilation.

### mendel-transform-buble

IST transform. Runs Bublé (a faster, simpler ES2015 → ES5 transformer). Dependency on Bublé `^0.20.0`, which is effectively unmaintained since 2019. Likely kept for backward compatibility.

### mendel-transform-inline-env

IST transform. Uses Babel + `babel-plugin-transform-inline-environment-variables` to replace `process.env.NODE_ENV` and similar literals with their current values at build time.

### mendel-transform-istanbul

IST transform. Instruments source with Istanbul coverage tracking using `babel-plugin-istanbul`. Used in test environments to collect code coverage across variational builds.

### mendel-transform-less

IST transform. Compiles LESS source to CSS using `less` and PostCSS. Marked `mode: "ist"` meaning it processes files independently.

### mendel-transform-uglify

IST transform. Minifies JavaScript using UglifyJS. Can be used as an IST step (per-file) as opposed to the manifest-level uglification done by `mendel-manifest-uglify`.

---

## Utilities and Dev Tools

### mendel-requirify

**Browserify plugin (legacy).**

Writes individual processed dep files from the Mendel browserify pipeline to disk. Uses `through2` streams and the `mendel-development` helpers. This predates the current `mendel-pipeline` architecture; likely only relevant to pre-v4 Mendel users.

### mendel-parser-json

**IST transform: JSON file parser.**

Wraps JSON files in a `module.exports = ...` wrapper so they can be bundled like regular JS modules. Marked `mode: "ist"`.

### mendel-treenherit

**Browserify transform (legacy).**

A browserify-specific transform that implements the folder-inheritance resolution for variations. Predates the pipeline architecture; depends on `async@^1.x`, `browser-resolve`, and `browserify-transform-tools`, none of which are used elsewhere in v4. This package should be considered deprecated.

### mendel-exec

**In-process module execution for SSR.**

Provides a way to execute Mendel-processed modules inside a Node.js process context for server-side rendering, with source map support for correct stack traces. Includes `global-props.js` for injecting browser globals and `source-mapper.js` for stack trace transformation.

### mendel-development-middleware

**Development HTTP middleware (legacy).**

A middleware for development builds that likely provided hot reloading or build-on-demand serving in the v1/v2 era. Not clearly integrated into the v4 pipeline architecture.

### mendel-mocha-runner

**Mocha integration for running tests against Mendel variations.**

Runs Mocha test suites against variation-specific builds, enabling test coverage across experiments.

### karma-mendel

**Karma integration.**

Karma framework plugin for running browser tests against Mendel-processed bundles. Enables in-browser test execution across variations.
