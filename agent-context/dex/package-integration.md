# Package Integration and Data Flow

## Dependency Graph

```
mendel-config
  └── consumed by: mendel-pipeline, mendel-middleware, mendel-development-middleware,
                   mendel-core, mendel-loader, mendel-exec

mendel-development
  └── consumed by: mendel-pipeline (debug-filter, variation-matches, proxy),
                   mendel-development-middleware (resolve-variations),
                   mendel-resolver (debug-filter)

mendel-resolver
  └── consumed by: mendel-pipeline/src/deps (DepsManager worker)
                   mendel-exec

mendel-deps
  └── consumed by: mendel-pipeline/src/deps (DepsManager.detect)

mendel-pipeline
  └── consumed by: mendel-development-middleware (MendelClient)
                   CLI users

mendel-core
  └── consumed by: mendel-middleware, mendel-loader

mendel-loader
  └── consumed by: mendel-middleware

mendel-exec
  └── consumed by: mendel-development-middleware, mendel-mocha-runner

mendel-outlet-manifest
  └── consumed by: mendel-outlet-server-side-render (extends it)

mendel-manifest-uglify
  └── consumed by: mendel-outlet-manifest
```

---

## Data Flow: Build Phase

### Config → Daemon

`mendel-config(options)` returns a fully normalized config. `MendelPipelineDaemon` calls it once per environment (default + any declared `env` overrides + `development`). Each environment gets its own config object, its own `MendelCache`, and eventually its own `MendelPipeline`.

### FsWatcher → CacheManager → MendelCache

```
FsWatcher (chokidar)
  add/change/unlink events
    → CacheManager.addEntry(path) / removeEntry(path)
        → MendelCache.addEntry(path)
            → new Entry(path)
            → entry.normalizedId = cache.getNormalizedId(path)
            → entry.variation = cache.getVariation(path)
            → entry.type = cache.getInitialType(path)
            → cache emits 'entryAdded'
```

### Pipeline Step Chain

```
Initialize
  listens: cache 'entryAdded'
  emits: 'done' {entryId}

FileReader
  reads: fs.readFile(entry.id)
  writes: registry.addSource({id, source, deps:{}})
  emits: 'done' {entryId}

IST (IndependentSourceTransform)
  reads: entry.type → types config → transform ids
  sends to TransformManager: {filename, transforms, source, map}
  TransformManager → worker process → mendel-transform-* → {source, map}
  sends to DepsManager: {filePath, source}
  DepsManager → worker process → mendel-deps (AST) → {imports: [literals]}
              → mendel-resolver.resolve(literal) per import → {main, browser, module}
  writes: registry.addTransformedSource({id, source, deps, map})
  emits: 'done' {entryId}

Waiter
  accumulates: entry IDs until cache.size() === waited.size
  emits: 'done' for all entries when condition met

GST (GraphSourceTransform)
  reads: registry.getDependencyGraph(entry.normalizedId, depGetter)
  calls: explorePermutation(graph, callback)
  per (chain, variation): loads GST plugin → plugin.transform(chainProxy, config, context)
  writes: registry.addTransformedSource({id, source, map, deps}) or context.addVirtualEntry({})
  emits: 'done' {entryId} when all entries processed through all GSTs

End
  writes: registry.doneEntry(entry.id) → cache.doneEntry(id) → cache emits 'doneEntry'
  emits: 'done' {entryId}
```

### CacheServer → CacheClient: The IPC Bridge

```
CacheManager 'doneEntry' event
  → CacheServer._sendEntry(client, size, entry)
      → client.send({ type:'addEntry', entry: serializeEntry(entry), totalEntries })
          entry fields: {id, normalizedId, variation, type, runtime, deps, source, map, rawSource}

CacheClient receives 'addEntry'
  → MendelOutletRegistry.addEntry(entry)
  → checks: registry.size === data.totalEntries → emit 'sync'

CacheClient receives 'removeEntry' (file change)
  → MendelOutletRegistry.removeEntry(id)
  → emit 'unsync' (triggers re-sync cycle)
```

---

## Data Flow: Bundle Generation Phase

After `CacheClient` emits `sync`, `BaseMendelClient.onSync()` fires.

### Registry → Generators

```
MendelGenerators.performAll(bundles)
  sort bundles by generator declaration order
  for each bundle:
    find generator plugin by bundle.options.generator
    call plugin(bundle, doneBundles, registry, options)

Default generator:
  registry.getEntriesByGlob(bundle.options.entries) → entry[]
  for each entry: registry.walk(normalizedId, {types, runtime}, visitor)
    visitor receives each dep entry
    resolvedEntries.set(dep.id, dep)
  bundle.entries = resolvedEntries (Map<id, entry>)
  return bundle

generator-extract:
  walks lazy entries and main entries separately
  mutates fromBundle.entries (removes moved entries)
  sets/clears entry.expose on individual entry objects
  bundle.entries = extractedBundle
  return bundle

generator-node-modules:
  filters node_modules entries from doneBundles
  moves them from source bundle.entries to vendor bundle.entries
  sets entry.expose = normalizedId for deps used by main

generator-prune (post-generator):
  iterates all bundles in a group
  removes deps pointing outside the group
  remaps expose IDs to canonical normalizedId forms
```

### Bundles → Outlets

```
MendelOutlets.perform(bundles, variations)
  for each bundle:
    find outlet plugin by bundle.options.outlet
    new Plugin(mendelConfig, outletOptions)
    plugin.perform(bundle, variations)

browser-pack outlet:
  bundle.entries (Map<id, entry>) → getPackJSON()
    groups entries by normalizedId → [{id, data:[{variation, source, deps, ...}]}]
    assigns numeric indexes to internal (non-exposed) modules
  matchVar(data, variations) → selects correct variation's data per module
  writes to browser-pack stream → JS bundle file or stream

manifest outlet:
  bundle.entries → getV1Manifest()
    {indexes: {normId: index}, bundles: [{id, variations:[], data:[]}]}
  optionally: envify (babel inline-env), uglify (manifest-uglify)
  fs.writeFileSync(manifestFileName, JSON.stringify(manifest))

ssr outlet (extends manifest):
  calls super.perform() to write manifest JSON
  for each entry: transformFile() → optionally rewrite requires → saveFileToDisk()
  destination: outdir/ssr-dir/variation/entry.id
```

---

## Data Flow: Request Handling (Production)

```
HTTP GET /mendel/:hash/:bundle.js
  → mendel-middleware
  → trees.findTreeForHash(bundle, hash)
      → MendelHashWalker walks manifest bundles
      → returns {deps: [{id, source, deps, ...}]}
  → indexedDeps(deps) — renames dep IDs to numeric indexes
  → browser-pack.pipe(res)
  → pack.write(module) for each module
```

```
app code: req.mendel.setVariations(['cart_sidebar'])
  → trees.variationsAndChains(['cart_sidebar'])
      → lookupChains = [['experiments/cart_sidebar'], ['src']]
      → matchingVariations = ['cart_sidebar', 'base']

app code: req.mendel.getURL('main')
  → trees.findTreeForVariations('main', lookupChains)
      → MendelVariationWalker walks manifest
      → computes hash of variation combination
      → returns {hash, deps}
  → getPath({bundle:'main', hash}) → '/mendel/abc123/main.js'
```

```
app code: req.mendel.resolver(bundles, lookupChains).require('myapp')
  → trees.findServerVariationMap(bundles, lookupChains)
      → MendelServerVariationWalker builds {normalizedId: filePath} map
  → new MendelResolver(parentModule, variationMap, serveroutdir)
      → require hooks map normalizedId → variation file path
```

---

## Data Flow: Request Handling (Development)

```
HTTP GET /mendel/:variations/:bundle
  → mendel-development-middleware
  → client.registry (MendelOutletRegistry, live from daemon)
  → assembles bundle on demand from registry entries
  → streams JS response

app code: req.mendel.resolver().require('myapp')
  → execWithRegistry(client.registry, 'myapp', variationConfigs)
      → mendel-exec: matchVar(normId, entries, variations, runtime)
          → selects correct entry by variation chain priority
      → runEntryInVM(filename, source, sandbox, customRequire)
          → vm.runInContext(m.wrap(source), sandbox, {filename})
          → recursively resolves deps through registry
```

---

## Multi-Process Communication (Transforms and Deps)

```
Main process (MendelPipeline)
  → TransformManager.transform(filename, ids, source, map)
      → BaseMasterProcess.dispatchJob({transforms, filename, source, map})
          → pick idle worker → worker.send({type:'START', args})
          → worker process (transformer/worker.js)
              → loads each transform plugin
              → calls plugin.transform({source, map, filename}, options)
              → worker.send({type:'DONE', message:{source, map}})
          → main process resolve promise
      → return {source, map}

  → DepsManager.detect(entryId, source)
      → BaseMasterProcess.dispatchJob({filePath, source, projectRoot, ...})
          → deps worker (deps/worker.js)
              → mendel-deps(source, filePath) → {imports: [literals]}
              → for each literal: MendelResolver.resolve(literal)
              → worker.send({type:'DONE', message:{filePath, deps}})
              OR: worker.send({type:'has', filePath}) to check cache
                  → main answers via subscriber
          → main process resolve promise
      → DepsManager.resolve(entryId, rawDeps) — applies shim overrides
      → return {id, deps}
```

---

## Entry Object Lifecycle

An entry starts as a bare path string and gains properties as it moves through the pipeline:

| Stage                                 | Properties Added                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `cache.addEntry(id)`                  | `id`, `normalizedId`, `variation`, `runtime`, `type`, `_type`                |
| `FileReader`                          | `rawSource`                                                                  |
| `IST → registry.addTransformedSource` | `source`, `deps` (normalized), `map`                                         |
| After IST                             | `istSource`, `istDeps` (snapshot for GST first pass)                         |
| GST (if transform applied)            | `source`, `deps`, `map` (updated)                                            |
| `End → cache.doneEntry`               | `done = true`                                                                |
| Serialized to client                  | `{id, normalizedId, variation, type, runtime, deps, source, map, rawSource}` |
| Generator walk                        | `entry`, `expose`, `order` (mutated in place)                                |

---

## Configuration Cross-Cutting Concerns

`mendel-config` is the shared truth. Every consumer receives the same normalized object (or a per-environment variant). Key connections:

-   **Types** define which transforms run on which files and whether the file is binary/resource
-   **Transforms** define IST or GST mode and plugin path; the pipeline reads these to route files
-   **Bundles** define entry globs, which generator to use, which outlet to use, and output paths
-   **Generators** are ordered; the order determines which bundles have their entries available for cross-bundle operations (extract, node-modules)
-   **Outlets** receive `mendelConfig` (full) plus `outletOptions` (per-outlet); they produce the artifacts
-   **VariationConfig.allDirs** drives FsWatcher subscription — all variation dirs are watched
-   **cacheConnection** (`type: unix`, `path: .mendelipc`) is shared between daemon and all clients; changing it requires updating both sides simultaneously
