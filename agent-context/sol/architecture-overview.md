# Mendel Architecture Overview

## What Mendel Is

Mendel is a JavaScript bundle build system designed specifically for A/B testing and experimentation on isomorphic web applications. Its central premise: rather than using `if (experimentA) { ... }` conditionals in shared code, you create file-system variations — copies of only the files that differ — and Mendel resolves which file to use per variation at request time. This eliminates tech debt from conditional experiment code and keeps bundles free of experiment payload for users who are not in a given bucket.

## The Mental Model: Tree Inheritance

Every variation is a directory overlay over a base directory. When Mendel resolves a module `./views/cart.js` for a user in experiment `live_cart_sidebar`, it checks the variation directory first; if not found, falls back through a configured chain until it reaches base. This lookup chain is the core primitive — it powers both build-time bundle generation and runtime serving.

The structure is deliberately simple:

```
src/                           # base
experiments/live_cart_sidebar/ # variation overlay
```

Only the changed files exist in the variation directory. Mendel constructs the full resolved tree as a virtual merge — nothing is written to a merged directory.

## Two-Process Architecture

Mendel runs as two cooperating processes connected over a Unix socket (or TCP):

**Daemon process (`mendel-pipeline`)**: Owns the file system, transformation pipeline, dependency resolution, and the in-memory cache. Runs continuously, watches files, and processes every source entry. Exposes completed entries to clients via a socket server (CacheServer).

**Client process (`mendel-pipeline`)**: Connects to the daemon, receives the fully processed cache, then runs generators and outlets to produce output artifacts (bundle files, manifests, etc.). The client can be a one-shot build process or an HTTP server that builds on demand.

This split has a key payoff: the daemon can keep all environments (development, production, test) warm concurrently, and multiple clients can request output without reprocessing source.

## The Build Pipeline (Daemon Side)

Inside the daemon, each environment gets its own `MendelPipeline` instance. The pipeline is a chain of steps, each emitting `done` events that trigger the next step:

```
Initialize → FileReader → IST → Waiter → GST → End
```

**Initialize**: Listens to `MendelCache.entryAdded` events, which are fired by the filesystem watcher or dependency resolution. Every new entry ID flows into the chain via `setImmediate` to give the cache time to stabilize.

**FileReader**: Reads raw source bytes from disk. Skips entries that already have `rawSource` (virtual entries injected by GST).

**IST (Independent Source Transform)**: Applies per-file transforms in parallel using a worker pool (`Transformer`, `DepsManager`). Transforms are classified as `mode: "ist"`. After transforming, it calls `DepsManager.detect()` to parse `require`/`import` statements and resolve dependencies. Each resolved dependency triggers `cache.entryRequested()`, which adds new entries to the pipeline.

**Waiter**: Collects all entries in-flight. Holds them until every known entry has completed IST. This is a synchronization barrier: GST (which operates on the full dependency graph) cannot run until all files are transformed and all their dependencies discovered.

**GST (Graph Source Transform)**: Operates on the fully-assembled dependency graph. Transforms classified as `mode: "gst"` receive a complete dependency chain and can produce synthetic entries or rewrite sources that depend on cross-file context (e.g., code-splitting, tree-inheritance transforms). The GST iterates all cache entries once per GST plugin, using `explorePermutation` to run each graph-aware transform once per variation. Virtual entries created by GST are tracked and cleared on file changes.

**End**: Marks entries as `done` and notifies the CacheServer, which broadcasts completed entries to any connected clients.

## The Cache

`MendelCache` is an in-memory `Map<id, Entry>` with several secondary indexes:

-   `_normalizedIdToEntryIds`: groups all variation-specific files under one canonical ID (e.g., `./src/cart.js` normalizes to `./src/cart`)
-   `_packageMap`: handles `package.json` `browser` field aliasing for runtime-specific entry points
-   `_moduleAliasMap`: handles intra-module aliasing (e.g., superagent's internal browser mappings)
-   `_depIgnoreMap`: records `false`-valued browser-field mappings (modules explicitly excluded from browser bundles)

Each `Entry` carries: raw source, transformed source, dependency map (keyed by require literal, values per runtime: `main`, `browser`, `module`), variation, normalizedId, type, and runtime classification.

The `CacheManager` in the daemon manages one `MendelCache` per environment. When a new environment pipeline is initialized, `CacheManager.sync()` copies already-processed entries from existing caches, then the new pipeline only processes what is missing.

## Daemon-Client Communication

The `CacheServer` listens on a Unix socket. When a client connects and sends a `bootstrap` message specifying an environment, the server:

1. Emits `environmentRequested` so the daemon starts that environment's pipeline if not already running.
2. Replays all completed entries from the cache to the client.
3. Streams new `addEntry` / `removeEntry` / `errorEntry` messages as the pipeline processes files.

The `CacheClient` (in the client process) accumulates entries into a `MendelOutletRegistry` and emits `sync` when the count matches the daemon's reported total. After `sync`, the client runs generators and outlets.

## The Client Side: Generators and Outlets

When the client receives `sync`, it invokes `BuildAll.onSync()`:

```
generators.performAll(bundles) → outlets.perform(bundles)
```

**Generators** operate on the `MendelOutletRegistry`. Each bundle config declares an `entries` glob and optional generator plugins. Generators walk the dependency graph from entry points and collect the entries that belong to each bundle. Key generators:

-   `mendel-generator-extract`: Implements code splitting. Takes a "lazy" bundle's entry points, walks their dependencies, then removes from the parent bundle any module only needed by the lazy bundle, and exposes shared modules so both can reference them.
-   `mendel-generator-node-modules`: Filters a bundle to contain only `node_modules` entries (for vendor splitting).
-   `mendel-generator-prune`: Cleans dangling dependencies and normalizes paths after other generators run.

**Outlets** consume a completed bundle's entry set and produce output. Each outlet writes to a different format:

-   `mendel-outlet-browser-pack`: Packs JS entries into a browser-runnable bundle using `browser-pack`. Groups entries by `normalizedId` so all variations of a file coexist in the manifest, then picks the right variation at serve time.
-   `mendel-outlet-manifest`: Writes the Mendel v1 manifest format (a JSON with `indexes` + `bundles` arrays). This manifest is the on-disk representation of the processed bundle, consumed at runtime by `mendel-core`.
-   `mendel-outlet-css`: Concatenates CSS sources with source maps using PostCSS.
-   `mendel-outlet-server-side-render`: Extends `ManifestOutlet` to also write individual source files to disk for `require()`-based server-side rendering. Transforms `require` calls to point to the correct variation files.

## Runtime Serving: mendel-middleware + mendel-core

At request time (Express middleware), the path is:

1. Application code calls `req.mendel.setVariations(['live_cart_sidebar'])`.
2. The middleware calls `MendelTrees.variationsAndChains()` to expand variation IDs into lookup chains.
3. For each bundle request, `trees.findTreeForVariations(bundleId, lookupChains)` walks the manifest tree. `MendelVariationWalker` resolves each module to its best variation match per the lookup priority order, collecting SHA hashes.
4. The resolved tree is hashed (SHA of all module SHAs concatenated). The URL served to the browser is `/mendel/:hash/:bundle.js`.
5. When the browser requests that URL, the middleware decodes the hash back to the specific tree via `findTreeForHash`, then streams it through `browser-pack` to the browser.
6. Because the URL encodes the exact content hash, responses are served with `max-age=31536000` — permanent cache. Experiment information is never in the URL; the hash is content-addressable.

For server-side rendering, `MendelLoader` calls `trees.findServerVariationMap()` which returns a file path map, and `MendelResolver` intercepts `require()` calls to redirect them to the correct variation files.

## Configuration System

`mendel-config` reads `.mendelrc` (YAML) or `package.json` `mendel` field, applies defaults, merges environment overrides (`env.production.*`), and constructs typed configuration objects:

-   `VariationConfig`: expands variation directories and builds lookup chains
-   `TypesConfig`: file type classification by glob (js, css, node_modules, etc.), with associated transforms
-   `TransformConfig`: each transform plugin with its mode (`ist` or `gst`) and options
-   `BundleConfig`: entry globs, outlet reference, generator chain
-   `OutletConfig` / `GeneratorConfig` / `PostGeneratorConfig`: plugin resolution and options

Config validation catches circular parser type conversions and references to undefined transforms at startup.

## Dependency Resolution

`mendel-resolver` is a multi-runtime module resolver (not using Node's built-in `require.resolve`). It resolves `main`, `browser`, and `module` fields from `package.json`, handles the full browser-field remapping spec, and returns an object with per-runtime file paths. This allows the cache to store both the server-side (`main`) and browser-side (`browser`) entry point for a module simultaneously, letting outlets pick the right one.

`mendel-deps` parses source code using a worker pool to detect `require`/`import` literals without executing the code.

## Key Data Flow Summary

```
FS change → chokidar watcher → CacheManager.addEntry()
  → cache.entryAdded event → Initialize step → FileReader
  → IST (transform + dep detection) → new deps → more entries
  → Waiter (barrier: all IST done) → GST (graph transforms)
  → End → CacheServer broadcasts to clients
  → CacheClient accumulates → sync event
  → Generator walks registry → Bundle built
  → Outlet writes manifest/bundle/SSR files
  → HTTP request → middleware reads manifest → resolves variation tree
  → browser-pack streams to browser
```
