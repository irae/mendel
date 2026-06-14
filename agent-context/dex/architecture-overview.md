# Mendel Architecture Overview

## What Mendel Is

Mendel is a build system for JavaScript web applications that enables A/B testing through file-system-based variation inheritance. Rather than using code-level conditionals, Mendel lets you create a parallel directory tree per experiment. Files that exist in the experiment directory override their counterparts from the base source. Mendel then builds one bundle per variation combination.

The system has two runtime modes:

-   **Build mode** (`mendel-pipeline`): processes files, resolves dependencies, transforms source, and writes bundles to disk
-   **Serve mode** (`mendel-middleware` / `mendel-development-middleware`): responds to HTTP bundle requests by selecting the correct variation from a prebuilt manifest

---

## Key Concepts

### Variations and the Base

A "variation" is a named experiment. Each variation is a directory tree. When resolving a module, Mendel checks the variation directory first. If the file exists there, it uses it; otherwise it falls back through the chain to the base source directory. Multiple variations can be layered in a chain (multivariate testing).

### normalizedId

Every file gets a `normalizedId`, a path stripped of variation prefix and file extension. This is the stable identity that links the same logical module across all its variation files. For example:

-   `./experiments/cart_sidebar/views/ads.js` and `./src/views/ads.js` both normalize to `./views/ads`
-   Dependency maps use `normalizedId` as keys, allowing runtime selection of the correct variation

### Entries and the Cache

`MendelCache` is the central store during build. It maps each file path (`id`) to an `Entry` object containing:

-   Raw source
-   Transformed source
-   Dependency map (keyed by require literal, each dep having `main`, `browser`, `module` runtime slots)
-   Variation membership
-   `normalizedId` and `runtime`

### IST vs GST

Transforms fall into two modes:

-   **IST (Independent Source Transform)**: stateless transforms applied per file in isolation (Babel, inline-env, uglify, etc.)
-   **GST (Graph Source Transform)**: transforms that need the full dependency graph, applied after all ISTs are done. Used for code-splitting, tree-shaking, or other cross-file operations.

---

## End-to-End Pipeline

### 1. Configuration (`mendel-config`)

The pipeline starts with config. `mendel-config` reads `.mendelrc` or `package.json#mendel`, parses YAML, and returns a normalized config object with typed sub-configs for variations, transforms, types, bundles, generators, outlets, and shims.

### 2. Daemon Startup (`mendel-pipeline/src/daemon.js`)

`MendelPipelineDaemon` orchestrates the build side:

-   Creates one `MendelCache` per environment (development, production, etc.)
-   Starts `FsWatcher` (chokidar) on all variation directories
-   Creates `CacheServer` (Unix socket) to serve build results to client processes
-   Constructs `TransformManager` and `DepsManager` (both use multi-process workers via `BaseMasterProcess`)

### 3. File Discovery (FsWatcher → Cache)

When chokidar detects a file, it calls `cacheManager.addEntry(path)`. On initial startup, files are sorted by size (largest first) and `package.json` files are prioritized. This ensures large files start transforming early and package dependency maps are available before their referenced modules.

### 4. Pipeline Steps (`mendel-pipeline/src/pipeline.js`)

Each entry travels through a chain of steps. Each step emits `done` to trigger the next:

```
Initialize → FileReader → IST → Waiter → GST → End
```

**Initialize**: listens for `entryAdded` cache events and pushes entry IDs into the pipeline.

**FileReader**: reads the file from disk into `entry.rawSource`. Skips if source is already present (virtual entries).

**IST (IndependentSourceTransform)**:

1. Determines which transforms to apply based on the entry's type config
2. Sends file + source to `TransformManager` (IPC to worker processes)
3. After transform, sends source to `DepsManager` to detect `require`/`import` statements
4. `DepsManager` uses `mendel-deps` (AST walk via `@babel/parser` + `@babel/traverse`) to find literals, then `mendel-resolver` to resolve each to file paths
5. Calls `registry.addTransformedSource()` with source + dep map

**Waiter**: accumulates entries until all known entries have been IST-processed. Only then triggers GST. This barrier is necessary because GST operates on the full graph.

**GST (GraphSourceTransform)**: iterates registered GST plugins. For each plugin, it:

1. Calls `registry.getDependencyGraph()` to build the complete dependency graph for the entry
2. Calls `explorePermutation()` to enumerate each variation combination
3. For each (chain, variation) pair, invokes the GST plugin with the chain of entries
4. Plugins can return mutated source or create virtual entries via `context.addVirtualEntry()`

**End**: marks the entry `done` in the cache. Cache emits `doneEntry`, which `CacheServer` picks up and broadcasts to connected clients.

### 5. Worker Processes (Multi-Process)

`BaseMasterProcess` forks N child processes (`TransformManager` forks up to CPU count, `DepsManager` forks 2 for higher cache hit rate). A simple work queue dispatches jobs to idle workers via IPC. Workers run `mendel-transform-*` plugins synchronously and return source + source map.

### 6. Cache Server / Client Protocol

The daemon runs a `CacheServer` on a Unix socket (`.mendelipc`). Client processes connect via `CacheClient`, send a `bootstrap` message with the desired environment, and receive serialized entries as JSON. When all entries are received (`registry.size === totalEntries`), the client emits `sync`.

### 7. Client-Side Bundle Generation

After sync, the client (`build-all.js` or `build-ondemand.js`) runs:

1. **Generators**: for each configured bundle, a generator plugin walks the client-side registry (`MendelOutletRegistry`) to collect entries matching the bundle's entry glob patterns. The default generator does a depth-first walk starting from entry files. Specialized generators: `mendel-generator-extract` (code splitting), `mendel-generator-node-modules` (separating vendor bundle), `mendel-generator-prune` (post-generator that removes dangling deps and remaps external references).

2. **Outlets**: each populated bundle is passed to its configured outlet plugin. Outlets write the final artifact:
    - `mendel-outlet-browser-pack`: produces browser-ready JS bundles using `browser-pack`, grouping entries by `normalizedId` so all variation versions of a module are bundled together and runtime selection picks the correct one
    - `mendel-outlet-manifest`: writes a JSON manifest (v1 format) with source, deps, sha, and variation metadata for every entry — consumed by `mendel-core` at runtime
    - `mendel-outlet-server-side-render`: extends manifest outlet, writes individual transformed files to disk for SSR
    - `mendel-outlet-css`: concatenates CSS sources into a single file

### 8. Production Request Handling (`mendel-middleware`)

In production, the server loads pre-built manifests via `mendel-core`. When a request comes in:

1. App code calls `req.mendel.setVariations(variations)` to declare which experiments apply
2. `mendel-core/trees.js` walks the manifest, selecting entries per variation chain
3. Bundle URL is `/mendel/:hash/:bundle.js`. The hash encodes the variation combination, enabling long-term CDN caching (same bundle = same hash)
4. `mendel-middleware` compresses dep IDs to numeric indexes (`indexedDeps`) and pipes through `browser-pack` on the fly

### 9. Development Request Handling (`mendel-development-middleware`)

In development, there are no manifests on disk. The middleware connects to the running daemon's `CacheClient`, receives live entries, and executes SSR via `mendel-exec` (Node.js `vm` module with variational `require`). Bundle JS is assembled on demand from registry state.

The development URL scheme differs from production: `/mendel/:variations/:bundle` encodes variation names directly, while production uses content hashes. This means development URLs are not cacheable but are human-readable during debugging.

### 10. `CacheManager.sync()`: Cross-Environment Cache Seeding

When the daemon starts a new environment pipeline, `CacheManager.sync()` copies already-processed entries from any existing environment cache into the new one. This avoids re-processing files that share transforms across environments. A TODO in the source acknowledges the seeding is imperfect: if browser-field deps diverge between environments, entries seeded from a different environment may carry wrong dependency data.

---

## Lifecycle Summary

```
[File System]
    → FsWatcher (chokidar)
    → CacheManager.addEntry
    → Initialize step emits → FileReader → IST (parallel workers) → Waiter → GST → End
    → CacheServer broadcasts done entries over Unix socket
    → CacheClient receives, builds MendelOutletRegistry
    → Generators collect entries per bundle
    → Outlets write bundles/manifests to disk
```

At request time (production):

```
HTTP request → mendel-middleware → mendel-core walks manifest → selects variation → browser-pack → response
```

At request time (development):

```
HTTP request → mendel-development-middleware → CacheClient registry (live) → mendel-exec (vm) or bundle stream → response
```

### Binary Serialization in `mendel-core`

`MendelTrees` uses `tree-serialiser.js` and `tree-deserialiser.js` (backed by `concentrate` + `dissolve`) to store resolved variation trees in compact binary form for hash lookup. This is how `findTreeForHash` reconstructs a variation tree without re-walking the manifest on every request.
