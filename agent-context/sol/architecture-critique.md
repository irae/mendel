# Architecture Critique

## What Works Well

### The Core Idea Is Architecturally Sound

The file-system-overlay approach to A/B testing is the strongest design decision in Mendel. By treating each experiment as a directory diff rather than a code conditional, it achieves the core promise: zero runtime overhead for users not in an experiment, clean experiment disposal (just delete the directory), and no leakage of experiment logic into base code. This is harder to achieve than it looks; most tooling conflates bundle generation with experiment resolution.

### The Two-Process Split Earns Its Complexity

The daemon-client split over a Unix socket is real engineering for a real problem. Keeping the transformation pipeline running continuously while separate client processes come and go (CI build, dev server, test runner) avoids re-processing on every invocation. The `CacheManager.sync()` pattern that seeds a new environment's cache from an existing one is clever and would be invisible if it weren't for the TODO comment calling it imperfect.

### Content-Addressable URLs Are the Right Primitive

Using SHA hashes of module content as bundle URLs, then serving those URLs with permanent cache headers, is a clean production pattern. Experiment identity is not in the URL — the URL only identifies exact content. This means CDNs can serve experiment bundles with no knowledge of the experiment system.

### The IST/GST Distinction Solves a Real Problem

Separating per-file transforms (IST) from graph-aware transforms (GST) is architecturally honest. Most bundler plugin systems blur this boundary and then have subtle ordering bugs. Mendel's explicit Waiter step that blocks GST until all IST is done is a correct synchronization strategy. The `explorePermutation` logic in GST that enumerates variation-specific chains for graph transforms is non-obvious but necessary.

### MendelCache's Dependency Model Is Thorough

The cache tracks per-runtime dependency paths (`main`, `browser`, `module`) for every require literal, handles package.json browser-field aliasing, intra-module remapping, and the `false`-valued exclusion pattern. This is more complete than most bundlers handle for the browser-field spec, and it's all in one place.

### File Priority Queue at Startup

Sorting initial files by size (largest first) and processing `package.json` files before their referencing modules is a meaningful heuristic. Package dependency maps must be available before the files they describe, or the cache mis-classifies module runtimes. Large files starting early means slower transforms don't become a tail-end bottleneck.

### DepsManager Worker Count Is Intentionally Low

`DepsManager` caps at 2 worker processes while `TransformManager` forks up to the CPU count. The difference is deliberate: module resolution for `node_modules` packages recurs constantly across different files, and each worker maintains an in-process resolution cache. Fewer workers means higher cache hit rate per worker. Two workers balances parallelism against cache reuse.

---

## Where the Architecture Has Problems

### The Waiter Barrier Is a Scalability Bottleneck

The Waiter step holds all entries until the entire cache is IST-complete before any can advance to GST. In a large application with hundreds of modules, this means GST cannot start until the last slow file (perhaps a heavy Babel transform) finishes. There is no partial GST processing for modules whose dependency subgraphs are already fully IST-complete. The comment in the Waiter source acknowledges this explicitly (`TODO: ... it will be safe to add optimization here`) but has not been resolved. For large codebases this is a material build-time cost.

### The GST Design Has an Acknowledged Race Condition

In `gst/index.js`, the comment `// FIXME GST can be difference for main and browser.` identifies that the graph transform only uses `main` runtime dependencies for graph traversal. If a file has different browser-runtime dependencies, the GST may produce incorrect output for browser bundles. This is not a theoretical edge case; any module that imports something differently via the browser field will hit this.

### The `watchNextEnv` Feature Is Commented Out With a Critical TODO

```js
if (environment === 'development' && Boolean(process.env.MENDEL_BETA)) {
    this.watchNextEnv(currentPipeline);
}
```

And inside `watchNextEnv`:

```js
if (nextEnv === 'production') {
    // TODO: Figure out production problems, likely related to
    //       deps being different and cache not creating a perfect sandbox
    return;
}
```

This means the optimization of pre-warming production while developing is gated behind `MENDEL_BETA` and explicitly skips production, which is the environment that matters most. The underlying deps sandboxing issue is fundamental: the cache is not perfectly isolated per environment, and if browser-field deps diverge between environments, the cache can return wrong results. This appears to be a known but unresolved correctness issue.

### Daemon Process Coupling to `node-libs-browser`

The daemon hard-codes `node-libs-browser` as the default shim set for all browser targets:

```js
const DefaultShims = require('node-libs-browser');
```

This was reasonable when `node-libs-browser` was the standard Webpack/Browserify shim set, but that package is now unmaintained and targets Node.js APIs as they existed circa 2016. Projects that need modern replacements (e.g., `buffer` v6+, `crypto-browserify` alternatives) have no clean hook to override this at a package level; they must override in config manually.

### The Registry/Cache Split Is a Thin Abstraction With Leaky Seams

`MendelRegistry` wraps `MendelCache` but adds almost nothing except an event-logging version of `emit`. All real logic is on the cache. Meanwhile `MendelOutletRegistry` (the client-side registry) is a separate, non-inheriting class that reimplements similar logic with different semantics. There are now three places maintaining parallel "normalized ID to entry" indexing (`MendelCache`, `MendelRegistry`, `MendelOutletRegistry`). Any subtle difference in how they handle edge cases creates divergence between what the daemon sees and what the client outlets act on.

### Error Handling Has Multiple `process.exit(1)` Sites

`FileReader` calls `process.exit(1)` on read errors. The daemon calls `process.exit(1)` on server errors. `CacheManager` wires up `process.exit(1)` on entry errors in non-watch mode. This spreads exit policy throughout the code rather than surfacing errors to a single handler. It makes testing error paths difficult and prevents calling code from doing graceful cleanup or retry.

### The Manifest Format Carries Both Build and Runtime Concerns

`mendel-outlet-manifest` writes a v1 manifest format with `uglify: true` and `envify: true` as defaults, running UglifyJS and Babel env-inlining at outlet time. This means the manifest written to disk is already minified and environment-specific, which makes the manifest format unsuitable for reuse across environments without regeneration. A cleaner split would be: emit a clean manifest (source + deps only), and have environment-specific minification as a post-process step that the serving layer applies.

### The `mendel-treenherit` Package Is an Orphan

`mendel-treenherit` is a browserify transform that predates the current pipeline architecture. It depends on `async` v1, `browser-resolve`, and `browserify-transform-tools` — none of which align with the rest of the codebase. This package appears to be a compatibility shim from the pre-pipeline era and is likely unused by any modern Mendel consumer, but it remains in the monorepo creating maintenance surface.

### Multivariate Support Is Theoretically Present but Practically Incomplete

The `MendelVariationWalker` tracks a `conflicts` counter for when a module is resolved from more than one active variation. The comment and code show this was designed to detect multivariate conflicts. However, the GST explicitly states `// We do not yet support multi-variation.` and the `explorePermutation` function processes one variation at a time. The public API (README, middleware) presents multivariate as supported, but the pipeline's GST step is single-variation-at-a-time.

### `development` vs `production` Pipeline Behavior Is Underspecified

The daemon creates pipelines per environment and has a `watchNextEnv` strategy for pre-warming, but the relationship between what a development-mode client gets and what a production build emits is implicit. The client-side registry is populated from whatever entries the daemon sends; there is no schema or contract between the two sides. If the daemon changes the entry serialization format (see `serializeEntry` in `cache/server.js`), the client can silently receive malformed data. The IPC protocol has no versioning.

### The Unix Socket IPC Has No Framing or Versioning

The cache server/client communicate by `JSON.stringify`/`JSON.parse` over a Unix socket. There is no message framing protocol — it relies on the OS delivering messages atomically, which is only true for small payloads. Large source files with many modules could theoretically fragment across socket reads, though in practice Unix domain sockets with small writes tend to be atomic on Linux. But this is unspecified and untested for large payloads.

### CacheClient Has No Back-Pressure

`CacheClient` receives JSON messages from the daemon and adds them to the registry as fast as they arrive. If the daemon is fast and the client is slow (e.g., during outlet writes that trigger further processing), messages queue in the socket's receive buffer with no throttling. For small projects this is fine, but under load the client can receive thousands of entries before it acknowledges `sync` state.

### Generator Execution Is Sequential

`MendelOutlets.perform()` calls `Promise.all()` across outlets, which is correct. But `MendelGenerators.performAll()` runs generators in declaration order with no parallelism. For projects with many independent bundles, generators run serially even though most bundles have no dependencies on each other.

### Variation Permutation Exploration Is Brute Force

`GST.explorePermutation()` iterates all entries in the dependency graph for every variation in the config. For projects with many files and many variations, this is O(files × variations). Subgraphs that have not changed between variations are reprocessed on every permutation. Memoizing completed subgraphs per variation would reduce redundant work.

### Registry `walk()` Relies on Caller Side-Effects

`MendelOutletRegistry.walk()` passes a visitor function that callers use to mutate `entry.expose` in place. `mendel-generator-extract` sets `entry.expose = entry.normalizedId` during the walk, then later clears it. This couples generators to the registry's internal entry objects rather than working on copies, and makes the walk's behavior dependent on mutation order.

### TCP Is Anticipated but Never Implemented

`network.js` validates that only `type: unix` is supported, yet the config defaults include `host` and `port` fields. If a deployment needs the daemon and client on separate machines (e.g., Docker environments where filesystem sharing is unavailable), there is no path. The architecture anticipated TCP but never built it.
