# Architecture Critique

## Strengths

### Variation Model is Conceptually Sound

The file-system-based overlay is elegant. It requires no AST manipulation of existing code and produces variations that are fully disposable after an experiment ends. The `normalizedId` abstraction cleanly separates identity from location, which makes cross-variation dependency graphs tractable.

### Daemon/Client Split Enables Multiple Use Cases

Decoupling the build daemon from bundle generation clients lets the same daemon serve development middleware, production build, SSR outlets, and test runners simultaneously. The Unix socket protocol is simple and fast for local use.

### Multi-Process Transform Architecture

Parallelizing IST transforms across worker processes is correct. File transforms are embarrassingly parallel and CPU-bound. Capping `DepsManager` at 2 workers (rather than all CPUs) to improve cache hit rate is a genuine insight: repeated resolution of `node_modules` packages benefits from shared in-process caches per worker.

### File Priority Queue at Startup

Sorting initial files by size (large first) and processing `package.json` before their modules is a smart heuristic. Package maps must be known before the files they describe, or the cache will mis-classify module runtimes.

### Type System for File Classification

The `types` config with `isBinary`, `isResource`, `parserToType`, and `includeNodeModules` flags gives fine-grained control over how different file categories are transformed and dependency-detected.

---

## Weaknesses and Areas for Improvement

### Waiter Step is a Synchronization Barrier That Kills Incremental Builds

The `Waiter` step holds every entry until all IST work finishes before allowing any GST to run. In watch mode, any file change clears GST state and re-runs the whole barrier. This design means the pipeline cannot pipeline: GST cannot start until IST is 100% done for all entries. For large projects, this causes long idle periods where nothing useful happens. A better design would track GST readiness per connected component of the dependency graph.

### GST Entry Tracking Uses Count Comparison, Not Per-Entry Completion

`gstDone` considers GST finished when `this._processed.size >= this._cache.size()`. This works only if the cache does not change during GST. A file change mid-GST resets `_canceled = true`, but there is no mechanism to wait for in-flight GST promises to settle before restarting. This can cause race conditions during watch mode file changes.

### GST Uses Only `main` Runtime for Graph Traversal

`gst/index.js` carries the comment `// FIXME GST can be difference for main and browser.` The graph traversal uses `main` runtime dependency edges only. Any module with divergent browser-field dependencies gets a graph that misrepresents the browser bundle's actual module topology. This is not a theoretical edge case: any module that uses `package.json` `browser` field remapping hits this path.

### `MendelCache` and `MendelOutletRegistry` are Parallel but Inconsistent Implementations

The daemon side uses `MendelCache` (with an `Entry` class), and the client side uses `MendelOutletRegistry`. Both store entries keyed by `id` with a secondary map by `normalizedId`. However, they evolve independently, have different method names (`doneEntry` vs. `addEntry`), and handle dep normalization differently. A shared data layer abstraction would reduce drift.

### CacheClient Has No Back-Pressure

`CacheClient` receives JSON messages from the server and adds them to the registry as fast as they arrive. If the daemon is fast and the client is slow (e.g., during outlet writes), messages queue in the TCP receive buffer with no throttling. In practice this is fine for small projects, but under load the client can receive thousands of entries before it acknowledges ready state.

### Registry `walk()` Uses Prototype-Level Side Effects

`MendelOutletRegistry.walk()` receives a `visitorFunction` that callers use to mutate `entry.expose`. This works but entangles the walk abstraction with mutation side effects. The generator-extract plugin sets `entry.expose = entry.normalizedId` during the walk, then later removes it. This couples generators to the registry's internal entry objects rather than working on copies.

### `mendel-core` (v1 Manifest) is a Legacy Compatibility Layer

`mendel-core` exists to serve the v1 manifest format at runtime. Production request handling does a tree walk at request time, which is O(N) per request in the number of entries. The manifest outlet pre-computes indexes to speed this up, but the walk still reconstructs a full dependency chain per HTTP request rather than pre-computing per-variation bundles at build time.

### Error Handling is Fatal

In non-watch mode, `cacheManager.once('entryErrored', () => process.exit(1))` kills the process on the first error. In the `FileReader`, a read error also calls `process.exit(1)`. This is expedient but makes Mendel unsuitable as a programmatic build API (e.g., from a test harness that wants to recover from transform errors).

### `watchNextEnv` Has a Production Skip TODO

The daemon's `watchNextEnv()` explicitly checks `if (nextEnv === 'production') return`. The comment says it is due to unsolved production/deps sandboxing issues. This means watch mode in `MENDEL_BETA` mode never pre-warms the production environment, defeating the purpose of that optimization.

### Development Middleware re-invents SSR Module Loading

`mendel-exec` implements a custom CommonJS loader using Node's `vm` module. This requires maintaining source maps, shebang stripping, cycle detection, and a module cache. Node's native `Module._extensions` hook (used by `mendel-loader` in the legacy path) would be simpler and more compatible. The `vm` approach has known pain around native addons and `instanceof` checks across contexts.

### Config Has a Legacy Branch

`mendel-config/index.js` has two code paths: `require('./src')` (modern, v2) and `require('./legacy')` (ES5 compatible, v0.10-era). The branch condition is fragile: it checks for `'base-config'` key or empty object. A project with a minimal config could silently use the legacy parser.

### No Parallel Outlet Execution for Bundles in the Same Environment

`MendelOutlets.perform()` calls `Promise.all()` across bundles, which is correct. But generator execution (`performAll()`) is sequential: generators run in declaration order with no parallelism. For projects with many bundles, generators run serially even though most bundles are independent.

### Unix Socket Only

`network.js` validates that only `type: unix` is supported, though the config defaults include `host` and `port` fields. If users need to run the daemon and client on separate machines (e.g., Docker environments where file system sharing is unavailable), they cannot. The architecture anticipates TCP (field names suggest it) but never implemented it.

### Unix Socket Has No Message Framing

The daemon-client protocol uses `JSON.stringify`/`JSON.parse` over a Unix socket with no length-prefixed framing. It relies on the OS delivering each `client.send()` payload atomically. This holds for small messages on Linux domain sockets but is unspecified behavior for large payloads (e.g., source files with many deps). There are no tests for fragmented socket reads.

### IPC Protocol Has No Versioning

`serializeEntry` in `cache/server.js` defines the wire format. If the daemon upgrades its serialization (adding or removing fields), any connected client on a different version silently receives malformed entries. The `bootstrap` handshake carries no version field.

### Variation Permutation Exploration is Brute Force

`GST.explorePermutation()` iterates all entries in the dependency graph for every variation in the config. For projects with many files and many variations, this is O(files \* variations). Memoizing which subgraphs have already been processed per variation would reduce redundant work.
