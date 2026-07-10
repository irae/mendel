# Architecture Deep Dive

A technical reference for developers extending or contributing to Mendel. Read alongside `packages/mendel-pipeline/src/` — every concept here maps to a specific file.

## Two-Process Model

```
┌─────────────────────────────────┐         ┌────────────────────────────────┐
│ Daemon (mendel-pipeline)        │         │ Client(s)                      │
│                                 │         │                                │
│  FsWatcher (chokidar)           │         │  CacheClient                   │
│  CacheManager → MendelCache[ENV]│  Unix   │  → MendelOutletRegistry        │
│  MendelPipeline per environment │  socket │  → Generators                  │
│  TransformManager (N workers)   │ ◀─────▶ │  → Outlets                     │
│  DepsManager (2 workers)        │         │                                │
│  CacheServer                    │         │  Variants: build-all,          │
│                                 │         │  build-ondemand,               │
│                                 │         │  dev-middleware                │
└─────────────────────────────────┘         └────────────────────────────────┘
```

The daemon owns the filesystem, the transformation pipeline, and the per-environment caches. A client connects, names an environment, and receives the processed cache. Multiple clients can connect to one daemon (CI build + dev server + test runner). The daemon keeps environments warm concurrently.

## The Pipeline

Each environment runs a chain of steps connected by `done` events:

```
Initialize → FileReader → IST → Waiter → GST → End
```

**Initialize** (`step/initialize.js`) listens to `MendelCache.entryAdded` and pushes entry IDs into the chain via `setImmediate`.

**FileReader** (`step/file-reader.js`) reads source bytes from disk. Skips entries with `rawSource` already set (virtual entries from GST). Errors call `process.exit(1)`.

**IST** (`step/ist.js`, Independent Source Transform):

1. Looks up the transform IDs for the entry's type from `config.types`.
2. Sends the file to `TransformManager`, which dispatches to a worker that runs each `mendel-transform-*` plugin in sequence.
3. Sends the transformed source to `DepsManager`, which uses `mendel-deps` (AST walk via `@babel/parser` + `@babel/traverse`) to find `require`/`import` literals. Each literal goes through `mendel-resolver` to produce per-runtime paths (`main`, `browser`, `module`).
4. Calls `registry.addTransformedSource()` with the source and dependency map. Each newly discovered dependency triggers `cache._requestEntry()`, feeding new files back into the pipeline. This is how the dependency graph self-assembles.

**Waiter** (`step/waiter.js`) coordinates the IST-to-GST phase transition. It collects entries until `cache.size() === waited.size`, then releases them to GST. GST needs the full dependency graph to walk variation permutations, so the Waiter holds the first wave until that graph exists. On file changes the cache emits `entryRemoved`, the Waiter drops only the changed ids from its `waited` set (`cache.on('entryRemoved', id => this.waited.delete(id))`), and unchanged entries stay completed in `MendelCache._store`. The coordination is a phase boundary, not a re-build trigger.

**GST** (`step/gst/index.js`, Graph Source Transform) runs each GST plugin once per entry per variation:

1. Builds the dependency graph from the entry via `registry.getDependencyGraph()` (BFS, returns `Array<Entry[]>` grouped by `normalizedId`).
2. Calls `explorePermutation()` to enumerate variation combinations.
3. For each `(chain, variation)` pair, invokes the plugin with an `EntryProxy` chain — a restricted view exposing `source`, `deps`, `filename`.
4. Plugins return mutated source or call `context.addVirtualEntry()` to inject synthetic entries.

**End** (`step/end.js`) marks the entry done. The `CacheServer` picks up the `doneEntry` event and broadcasts the serialized entry to connected clients.

## Worker Pools

`BaseMasterProcess` forks child workers and dispatches jobs via IPC.

- **TransformManager**: up to CPU count workers. File transforms are CPU-bound and embarrassingly parallel.
- **DepsManager**: 2 workers — intentionally capped. `mendel-resolver` keeps an in-process resolution cache. Two workers maximize cache hit rate on repeated `node_modules` lookups while preserving some parallelism. More workers would shred cache locality.

## File Discovery Priority

At startup, `FsWatcher` sorts initial files largest-first and prioritizes `package.json` files. Both are deliberate: large files start transforming early to avoid tail-end bottlenecks; package browser-field maps must be cached before the modules they describe, or `DepsManager` mis-classifies runtimes.

## Key Data Structures

### `Entry`

Every file gains an `Entry` object in `MendelCache`. Fields accumulate through the pipeline:

| Stage                        | Fields added                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `cache.addEntry(id)`         | `id`, `normalizedId`, `variation`, `runtime`, `type`, `_type`                |
| `FileReader`                 | `rawSource`                                                                  |
| `IST → addTransformedSource` | `source`, `deps` (per-runtime: `main`, `browser`, `module`), `map`           |
| After IST                    | `istSource`, `istDeps` (snapshot for GST first pass)                         |
| GST (if transform applied)   | `source`, `deps`, `map` updated                                              |
| `End → doneEntry`            | `done = true`                                                                |
| Serialized to client         | `{id, normalizedId, variation, type, runtime, deps, source, map, rawSource}` |
| Generator walk               | `expose`, `order` mutated in place                                           |

### `normalizedId`

The file path stripped of variation prefix and extension. `./experiments/cart_sidebar/views/ads.js` and `./src/views/ads.js` both normalize to `./views/ads`. The `normalizedId` is the stable identity that links the same logical module across its variation files. Dependency maps key on it for runtime variation selection.

### `MendelCache` indices

- `_normalizedIdToEntryIds`: groups all variation files of one logical module
- `_packageMap`: `package.json` browser-field aliasing for runtime-specific entry points
- `_moduleAliasMap`: intra-module aliasing (e.g., superagent's internal browser remap)
- `_depIgnoreMap`: `false`-valued browser-field mappings (modules excluded from browser bundles)

### The Manifest

Written by `mendel-outlet-manifest` in `{indexes, bundles}` form. Each entry carries `id`, `deps`, `file`, `variation`, `source`, `sha`. `mendel-core` reads it at production server startup and walks it per request. The manifest is the only contract that crosses the build-to-runtime boundary; it has no explicit version field.

### Variation chain

`MendelTrees.variationsAndChains(['cart_sidebar'])` produces `[['experiments/cart_sidebar', 'src'], ...]`. The chain encodes resolution priority and is threaded through every walker call. It is reconstructed per request, never cached server-side. `MendelVariationWalker` increments a `conflicts` counter when two active variations both provide a different version of the same module — but there is no policy to resolve the conflict.

### Binary tree serialization

`mendel-core/tree-serialiser.js` and `tree-deserialiser.js` (using `concentrate` + `dissolve`) store resolved variation trees in compact binary form keyed by hash. This is how `findTreeForHash` reconstructs the tree at request time without re-walking the manifest.

## Package Map

### Core build and serve

| Package                         | Purpose                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `mendel-pipeline`               | Daemon (`MendelPipelineDaemon`), build clients, all pipeline steps, IPC, worker pools     |
| `mendel-config`                 | Parses `.mendelrc` / `package.json#mendel`, normalizes into typed sub-configs, validates  |
| `mendel-deps`                   | AST-based `require`/`import` literal detection (Babel parser + traverse; CSS `@import`)   |
| `mendel-resolver`               | Multi-runtime resolver returning `{main, browser, module}` per literal                    |
| `mendel-development`            | Shared utilities: variation matching, debug filtering, proxy, manifest helpers            |
| `mendel-core`                   | Production runtime: `MendelTrees`, walkers, binary tree (de)serializer                    |
| `mendel-middleware`             | Express middleware for production; mounts `req.mendel`, serves `/mendel/:hash/:bundle.js` |
| `mendel-development-middleware` | Dev middleware; live bundle assembly from daemon registry                                 |
| `mendel-loader`                 | Production SSR `require()` hook backed by `MendelTrees`                                   |
| `mendel-exec`                   | Development SSR via Node `vm`; custom variation-aware `require`                           |

### Generators

| Package                         | Purpose                                                                    |
| ------------------------------- | -------------------------------------------------------------------------- |
| `mendel-generator-extract`      | Code splitting: separates lazy-bundle entries from a parent bundle         |
| `mendel-generator-node-modules` | Vendor splitting: isolates `node_modules` into a dedicated bundle          |
| `mendel-generator-prune`        | Post-generator: removes dangling cross-bundle deps and remaps `expose` IDs |

### Outlets

| Package                            | Purpose                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `mendel-outlet-browser-pack`       | Browser JS bundle via `browser-pack`; auto-injects `process`/`global` IIFE shims  |
| `mendel-outlet-css`                | CSS concatenation with source maps via PostCSS                                    |
| `mendel-outlet-manifest`           | Writes the v1 manifest; optionally runs Babel env-inline + UglifyJS at write time |
| `mendel-outlet-server-side-render` | Extends manifest outlet; writes per-file SSR artifacts under `outdir/ssr-dir/`    |

### Transforms (IST plugins)

`mendel-transform-babel`, `mendel-transform-buble`, `mendel-transform-inline-env`, `mendel-transform-istanbul`, `mendel-transform-less`, `mendel-transform-uglify`. All implement `transform({source, map, filename}, options) → {source, map}`.

### Manifest post-processors

`mendel-manifest-extract-bundles` (post-build code splitting across written manifests), `mendel-manifest-uglify` (used internally by the manifest outlet).

### Test integrations

`karma-mendel` (browser test runner; fork of karma-commonjs), `mendel-mocha-runner` (Mocha + `mendel-exec`).

### Legacy and deprecated

`mendel-treenherit` (Browserify variation transform, predates v2 pipeline; depends on `async@^1.x`, `browser-resolve`, `browserify-transform-tools` — none used elsewhere). `mendel-requirify` (Browserify dep-file writer, v1 artifact). `mendel-parser-json` (JSON-to-CommonJS wrapper IST).

## Architectural Strengths Worth Preserving

- **Filesystem variation model.** The overlay-tree-as-experiment is the strongest design decision in Mendel. It produces fully disposable variations with no AST manipulation, no scattered conditionals, and uniform handling for all file types.
- **Daemon/client split.** One long-running daemon serves multiple short-lived clients (CI, dev server, tests). Source re-processing happens once. `CacheManager.sync()` seeds new environment pipelines from existing caches.
- **Content-addressable URLs.** SHA-of-resolved-content as the bundle URL, served with permanent cache headers, with no experiment names in the path. The CDN never knows the experiment system exists.
- **IST/GST distinction.** Most bundlers blur the line between per-file and graph-aware transforms and get subtle ordering bugs. The Waiter step makes the synchronization explicit.
- **Per-entry content cache drives incrementalism.** `MendelCache` keys each entry by id and tracks a `done` flag (`cache/index.js`, `cache/entry.js`). `FsWatcher` on change calls `removeEntry` then `addEntry` for the touched paths only (`fs-watcher/index.js`). Every other entry skips re-read, re-transform, and re-resolve. Cold start runs IST across CPU-count workers (`multi-process/base-master.js`), and the daemon stays warm so the second client sees a populated cache.
- **Multi-runtime dependency model.** `MendelCache` tracks per-runtime paths and handles browser-field remapping, intra-module aliasing, and `false`-valued exclusions in one place. More complete than most bundlers' browser-field handling.
- **Two-worker `DepsManager` cap.** A deliberate cache-hit-rate optimization, not an oversight.

## Specific Weaknesses

Listed with enough detail to act on. Each one has a TODO or FIXME in the source.

### Hot module replacement is unshipped, not blocked

Mendel has no HMR client. The architecture allows it: `MendelCache` already keys entries by id with a per-entry `done` flag, `FsWatcher` already drops only changed entries on disk events, and `CacheServer` already streams `addEntry` and `removeEntry` deltas to connected clients (`cache/server.js`). A browser-side runtime that consumed those deltas and swapped modules in place would close the gap. The work has not been prioritized because variation builds at Yahoo did not require it. A related optimization (`TODO: ... it will be safe to add optimization here` in `step/waiter.js`) would let entries bypass GST when no GST plugin applies, prioritizing hot initialization of the base variation or the most-requested bundle. Both are missing features, not architectural ceilings.

### GST uses only `main` runtime for graph traversal

`gst/index.js` carries `// FIXME GST can be difference for main and browser.` The graph walker uses `main` runtime dependencies only. Any module with a `browser` field remap will get an incorrect graph for the browser bundle. This is not edge-case territory; most real-world projects depend on packages that use the browser field. The fix is to walk per-runtime graphs separately or compute a union graph and label edges.

### `CacheManager.sync()` cross-environment seeding has a known correctness gap

When a new environment pipeline starts, `CacheManager.sync()` copies already-processed entries from existing environment caches. If browser-field deps diverge between environments, the seeded entries carry wrong dependency data. This is the root cause of the `watchNextEnv` production skip: `if (nextEnv === 'production') return` with the comment `TODO: Figure out production problems, likely related to deps being different and cache not creating a perfect sandbox`. The optimization to pre-warm production while developing is gated behind `MENDEL_BETA` and never reaches the environment that matters most.

### GST permutation exploration could memoize per variation

`GST.explorePermutation()` iterates all entries in the dependency graph for every variation in the config — O(files × variations). IST results stay cached across file changes, so the source transform cost stays incremental, but `clear()` on `entryRemoved` resets `_processed` and replays GST permutations. Memoizing completed subgraphs per variation would shrink that GST replay to the touched subgraph. The IST cache already makes refresh fast in practice; this would tighten the GST half of the same property.

### Three parallel entry stores

`MendelCache` (daemon), `MendelRegistry` (thin event-emitter wrapper around `MendelCache`), and `MendelOutletRegistry` (client-side) all maintain `normalizedId → entry[]` secondary indexes. They evolve independently with different method names and edge-case handling. `MendelOutletRegistry` additionally maps `false`-valued browser deps to a `_noop` module — a normalization that doesn't exist daemon-side. A shared data layer abstraction would prevent silent divergence.

### IPC has no framing and no versioning

The `CacheServer` and `CacheClient` exchange `JSON.stringify`/`JSON.parse` payloads over a Unix socket with no length prefix, no delimiter, and no version field. Unix domain sockets on Linux guarantee atomic delivery up to `PIPE_BUF` (typically 4KB or 64KB depending on kernel); large transformed source files can exceed this. There are no tests for fragmented socket reads. If the daemon changes `serializeEntry`, a connected client of a different version silently receives malformed entries.

### CacheClient has no back-pressure

`CacheClient` receives JSON messages and adds them to the registry as fast as they arrive. The client's in-memory registry grows unboundedly until `sync`. If the daemon sends entries faster than the client can index them, the client's event loop starves and outlet writes are delayed. The `totalEntries` counter becomes a lagging signal for client readiness.

### Generator execution is sequential

`MendelOutlets.perform()` uses `Promise.all()` across bundles. `MendelGenerators.performAll()` runs in declaration order with no parallelism. For 10 independent bundles, 9 of them wait while the first walks its dependency graph. The `doneBundles` dependency between generators is real for `extract` and `node-modules`, but most bundles in practice have no such dependency.

### Multivariate is incomplete

`MendelVariationWalker` increments a `conflicts` counter when multiple variations resolve the same module differently. There is no policy to resolve conflicts. GST has an explicit `// We do not yet support multi-variation.` and runs single-variation-at-a-time. The middleware API allows setting multiple variations; the build pipeline does not handle them fully.

### Fatal error handling

`FileReader`, the daemon server, and `CacheManager` (in non-watch mode) all call `process.exit(1)` on errors. Exit policy is spread across the code. Mendel is unsuitable as a programmatic build API (test harness, embedded build) because callers cannot recover.

### Unix socket only

`network.js` validates only `type: unix`. The config defaults include `host` and `port` fields, but TCP was never implemented. In Docker, if daemon and client run in separate containers, the socket path (`.mendelipc`) must be volume-mounted explicitly — non-obvious operational friction.

### Legacy config branch dispatches silently

`mendel-config/index.js` switches between `src/` (modern v2) and `legacy/` (v0.10-era ES5) parsers based on whether the config contains a `base-config` key. A minimal valid config can silently take the legacy path.

### Manifest carries build-time, environment-specific concerns

`mendel-outlet-manifest` defaults to `uglify: true` and `envify: true`. The on-disk manifest is already minified and has `process.env.*` replaced with build-environment values. The manifest cannot be reused across environments without regeneration. A clean manifest (source + deps only) with environment-specific post-processing would be more reusable.

### `mendel-core` walks the manifest per request

Production request handling does an O(N) walk through entries to build the variation tree. `findTreeForVariations` works but does not pre-compute per-variation bundles at build time. For high-traffic services with many variations, this is a request-time cost that could be amortized to build time.

### Development middleware uses `vm` for SSR

`mendel-exec` runs modules via `vm.runInContext`. The `vm` boundary creates an `instanceof` hazard — objects created in the VM context fail `instanceof` checks against host-context constructors. Isomorphic code that performs cross-boundary type checks works in production (`mendel-loader` + real `require`) but breaks silently in development.

## How To Extend Mendel

To add a new file type: register it in `types`, write or reuse a `mendel-transform-*` for IST. To add a graph-level operation: write a GST transform that receives a chain proxy. To add an output format: write an outlet. To customize bundle composition: write a generator that walks the `MendelOutletRegistry`. To intercept production routing: extend `mendel-middleware`. The plugin contracts are stable; the most painful surface to touch is the daemon's pipeline itself.
