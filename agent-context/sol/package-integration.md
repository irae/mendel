# Package Integration: Data Flow and Dependency Graph

## Dependency Graph

Below is the package dependency graph with directional arrows (A → B means A depends on B):

```
mendel-pipeline
  → mendel-config
  → mendel-deps
  → mendel-resolver
  → mendel-development

mendel-config
  (no internal Mendel deps; uses js-yaml, resolve, minimatch)

mendel-development
  (no internal Mendel deps; uses falafel, glob, through2)

mendel-deps
  (no internal Mendel deps)

mendel-resolver
  → mendel-development   (debug-filter utility)

mendel-middleware
  → mendel-core
  → mendel-loader

mendel-core
  → mendel-config

mendel-loader
  (no internal Mendel deps; uses mendel-core indirectly via consumer)

mendel-outlet-manifest
  → mendel-manifest-uglify

mendel-outlet-server-side-render
  → mendel-outlet-manifest
  → mendel-development

mendel-manifest-extract-bundles
  → mendel-development

mendel-requirify
  → mendel-development

mendel-exec
  (no internal Mendel deps)
```

Generator and outlet packages have no Mendel-internal deps beyond `debug`; they receive everything they need as function arguments from `mendel-pipeline`'s orchestration.

---

## Lifecycle and Data Flow Phases

### Phase 1: Startup (Daemon)

```
User invokes: mendel build  (or requires mendel-pipeline in server code)
  │
  ├─ mendel-pipeline/src/daemon.js
  │    ├─ mendelConfig()  ←── mendel-config reads .mendelrc
  │    ├─ MendelCache(config)
  │    ├─ Transformer(config)       ← worker pool for IST
  │    ├─ DepsManager(config, cacheManager)  ← worker pool for dep detection
  │    ├─ CacheServer(config, cacheManager)  ← Unix socket server
  │    └─ Watcher(config, cacheManager)  ← chokidar file watcher
  │
  └─ Watcher subscribes to variationConfig.allDirs (all source + variation dirs)
```

Config is the first thing constructed; everything else is parameterized by it. The config object carries fully-resolved plugin paths, typed variation chains, and the full transform/bundle/outlet configuration.

---

### Phase 2: File Discovery → Cache Entries

```
chokidar detects file add/change
  │
  └─ CacheManager.addEntry(filePath)
       ├─ cache.addEntry(filePath)
       │    ├─ assigns: variation, normalizedId, type, runtime
       │    └─ emits: 'entryAdded'
       │
       └─ MendelPipeline.Initialize listens to 'entryAdded'
            └─ setImmediate → emits 'done' → FileReader.perform()
```

The `CacheManager` fans out every new entry to all active environment caches simultaneously. This is how a file added to the dev environment also gets queued in the production environment cache (when that pipeline is running).

---

### Phase 3: IST — Independent Source Transform

```
FileReader.perform(entry)
  ├─ fs.readFile(entry.id)
  ├─ registry.addSource({id, source, deps: {}})
  └─ emits 'done' → IST.perform(entry)

IST.perform(entry)
  ├─ determines transform IDs for entry type (from config.types)
  ├─ Transformer.transform(entryId, transformIds, source, map)
  │    └─ worker pool: each worker runs the IST plugin (e.g., mendel-transform-babel)
  │         transform(source, map, options) → {source, map}
  │
  └─ DepsManager.detect(entryId, transformedSource)
       ├─ worker pool: mendel-deps parses require/import literals
       ├─ mendel-resolver resolves each literal to {main, browser, module} paths
       └─ .then({deps}) →
            registry.addTransformedSource({id, source, deps, map})
              └─ cache.setSource() → for each dep:
                   cache._requestEntry(dep)  ← feeds new entries back to Phase 2
                   (this is how the whole graph is discovered)
```

The dep resolution loop is the key mechanism by which the pipeline is "self-feeding." Each file's dependencies trigger new `entryRequested` events, which cause those files to be added to the cache, which triggers `entryAdded`, which flows into `Initialize` and starts a new IST chain for each discovered dependency.

---

### Phase 4: Waiter — Synchronization Barrier

```
IST.emit('done') → Waiter.perform(entry)
  ├─ adds entry to this.waited set
  └─ if (cache.size() === waited.size):
       emit 'done' for every cache entry → GST.perform()
```

The Waiter accumulates entries until its count matches the total cache size. Only then does it release the entire set to GST. This is a full-stop: no entry proceeds to GST until all entries have completed IST and all transitive dependencies have been discovered and IST-processed.

---

### Phase 5: GST — Graph Source Transform

```
GST.perform(entry)  (called for every entry once Waiter releases)
  ├─ skips node_modules entries
  ├─ for each GST plugin in config.transforms (mode: 'gst'):
  │    ├─ registry.getDependencyGraph(entry.normalizedId, depGetter)
  │    │    └─ BFS from entry, returning Array<Entry[]> (grouped by normalizedId)
  │    │
  │    └─ explorePermutation(graph, onPermutation)
  │         └─ for each variation present in the graph:
  │              chain = [best entry per dep per variation]
  │              gstPlugin.transform(chainProxy, config, context)
  │                ├─ may call context.addVirtualEntry({id, source})
  │                │    └─ feeds back into registry (bypasses FileReader)
  │                └─ may return {source, map, deps}
  │                     └─ updates entry source in registry
  │
  └─ gstDone(entry): when all entries processed for current GST plugin,
       advance to next GST plugin, or emit 'done' for each entry → End
```

GST plugins receive a `chainProxy` — a restricted view of the dependency chain for a specific variation. The `EntryProxy` exposes only the fields plugins need (`source`, `deps`, `filename`, etc.) and nothing more.

---

### Phase 6: End → Cache Server → Client

```
End.perform(entry)
  └─ registry.doneEntry(entryId)
       └─ cache.doneEntry(entryId)
            ├─ entry.done = true
            └─ cacheManager emits 'doneEntry' (cache, entry)
                 └─ CacheServer._sendEntry(client, size, entry)
                      └─ JSON over Unix socket → CacheClient
```

The `CacheServer` maintains a list of connected clients filtered by environment. Each completed entry is serialized (`serializeEntry`: strips internal fields, resolves variation to its chain) and broadcast to all clients registered for that environment.

---

### Phase 7: Client Reception → Sync

```
CacheClient receives 'addEntry' message
  ├─ MendelOutletRegistry.addEntry(entry)
  │    ├─ indexes by normalizedId
  │    └─ maps false-valued deps to '_noop' (special noop module)
  │
  └─ if (registry.size === totalEntries):
       client emits 'sync'
            └─ BuildAll.onSync() triggered

CacheClient receives 'removeEntry' message
  └─ registry.removeEntry(id) + client emits 'unsync'
```

No back-pressure exists on the client side: messages from the daemon arrive as fast as the socket can deliver them and are added to the registry immediately. If outlet writes or downstream processing is slow, entries accumulate in-process with no throttle signal sent back to the daemon.

---

### Phase 8: Generator Execution

```
BuildAll.onSync()
  └─ generators.performAll(bundleConfigs)
       └─ for each bundle config (in declaration order):
            ├─ instantiate Bundle(opts) → empty entries Map
            ├─ for each generator plugin declared for this bundle:
            │    generator(bundle, doneBundles, registry)
            │      ├─ registry.getEntriesByGlob(entries glob)
            │      ├─ registry.walk(normId, criteria, visitor)
            │      │    └─ DFS from entry, collecting matching entries
            │      └─ bundle.entries = resulting Map<id, entry>
            └─ doneBundles.push(bundle)  (available to subsequent generators)
```

Generators are pure functions of `(bundle, doneBundles, registry)`. They have no side effects beyond populating `bundle.entries`. The `doneBundles` list enables later bundles to reference what earlier bundles collected (e.g., `mendel-generator-extract` references its parent bundle).

The order of bundle declarations in config matters: generators for bundle B can reference bundle A's entries only if A appears before B.

---

### Phase 9: Outlet Execution

```
outlets.perform(bundles)
  └─ for each bundle:
       outletPlugin.perform({entries, options, id})
         ├─ mendel-outlet-browser-pack:
         │    → browser-pack stream → writes .js file
         ├─ mendel-outlet-manifest:
         │    → getV1Manifest() → envify → uglify → JSON.writeFileSync
         ├─ mendel-outlet-css:
         │    → PostCSS concat → writes .css file
         └─ mendel-outlet-server-side-render:
              → writes manifest (main runtime)
              → writes each entry as individual .js file
```

Outlets are given the `entries` Map from the generator phase. They write to disk and return Promises; the client waits for all outlets to resolve before emitting `done`.

---

### Phase 10: Runtime Serving

```
HTTP request arrives
  └─ mendel-middleware(opts) → Express middleware
       ├─ req.mendel.setVariations(['experiment_id'])
       │    └─ MendelTrees.variationsAndChains()
       │         └─ mendel-config reads variations.chain configuration
       │
       ├─ req.mendel.getURL('main-bundle')
       │    └─ MendelTrees.findTreeForVariations(bundleId, lookupChains)
       │         └─ MendelVariationWalker:
       │              walk(manifest, module, finder)
       │                └─ for each module: _resolveBranch()
       │                     picks best match from lookup chain priority
       │                     assembles SHA from all module SHAs
       │         └─ returns {deps: [...], hash: 'abc123'}
       │    returns URL: /mendel/abc123/main-bundle.js
       │
       └─ request for /mendel/abc123/main-bundle.js:
            MendelTrees.findTreeForHash('main-bundle', 'abc123')
              └─ MendelHashWalker decodes hash → specific variation tree
            browser-pack streams resolved modules to response
```

For SSR:

```
req.mendel.resolver(['main-bundle'], variations)
  └─ MendelLoader.resolver(bundles, lookupChains)
       └─ MendelTrees.findServerVariationMap(bundles, lookupChains)
            └─ MendelServerVariationWalker builds {normalizedId → filePath} map
       └─ new MendelResolver(parentModule, variationMap, serveroutdir)
            └─ patches Module._resolveFilename to intercept require() calls
                 redirecting them to variation-specific files in build/ssr/ dir
```

---

## Live vs. Post-Build Code Splitting

Two packages implement code splitting at different stages of the lifecycle:

-   `mendel-generator-extract`: operates on the live `MendelOutletRegistry` during the generator phase (Phase 8). Splits entries between bundles before any outlet writes.
-   `mendel-manifest-extract-bundles`: operates on already-written manifest JSON files. Reads multiple manifests, identifies shared deps, and restructures the files so a parent bundle exposes common deps and child bundles reference them externally.

These are parallel capabilities, not alternatives. A project using `mendel-generator-extract` during build may still use `mendel-manifest-extract-bundles` as a post-process step for more complex splitting scenarios.

---

## Cross-Cutting Concerns

### Entry Identity

An entry has three identity dimensions:

-   `id`: the actual file path (e.g., `./experiments/test_A/math.js`)
-   `normalizedId`: the canonical logical identity (e.g., `./app/math`) — strips variation dir, strips extension
-   `variation`: which variation bucket this entry belongs to (or `false` for base)

All packages that deal with entries use `normalizedId` as the join key when grouping across variations. The `id` is used for file system operations; `normalizedId` is used for dependency resolution and runtime variation selection.

### Config as the Single Source of Truth

`mendel-config` is imported at the top of every major component. The config object is the shared schema that connects:

-   The daemon (knows which variation dirs to watch)
-   The pipeline (knows which transforms to apply per type)
-   The client registry (knows which types to include or exclude as resources)
-   The outlets (knows where to write output)
-   The runtime (`mendel-core` / `mendel-middleware`) (knows variation chains for resolution)

Any change to config structure must be reflected in all layers. There is no schema file shared between build and runtime; the config is re-parsed independently by each process.

### The Manifest as the Interface Between Build and Runtime

The manifest JSON format (written by `mendel-outlet-manifest`, read by `mendel-core/trees.js`) is the contract between the build pipeline and the runtime. It must be backward-compatible across versions because:

-   The build process (daemon + client) may be upgraded independently of the running server.
-   The manifest is often committed to a repository or deployed as a build artifact.

`mendel-outlet-manifest.getV1Manifest()` writes this format; `MendelTrees._loadBundles()` reads it with a plain `require()`. There is no explicit versioning field in the manifest.

### The Variation Chain Is the Central Primitive

The lookup chain is constructed once per request by `MendelTrees.variationsAndChains()` and then threaded through all resolution calls. It encodes priority: `[['test_A', 'base'], ['test_B', 'base']]` means "for the first active experiment, try test_A then base; for the second, try test_B then base." The walker resolves each module using this priority, detecting conflicts when two experiments both provide a different version of the same module.

This chain is never stored server-side; it is reconstructed per request from the variation IDs declared by the application.
