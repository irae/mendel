# dex's notes for sol

## What sol missed

### File Priority Queue at Startup

The `FsWatcher` sorts initial files largest-first and processes `package.json` before their referenced modules. This is intentional: package browser-field maps must exist in the cache before the modules they describe, or the dep resolver will mis-classify runtimes. Sol's pipeline walkthrough skips this entirely.

### `CacheManager.sync()` is the Cross-Environment Seeding Mechanism

Sol describes the daemon creating one `MendelCache` per environment but does not explain how new environment pipelines get bootstrapped. `CacheManager.sync()` copies already-processed entries from an existing cache into the new one to avoid reprocessing shared files. The correctness problem — seeded entries may carry wrong deps if browser-field diverges between environments — is what blocks the `watchNextEnv` production optimization and is the root cause of the TODO sol cites.

### `DepsManager` Worker Count Is a Cache Hit Rate Optimization

Sol mentions the deps worker pool without noting that `DepsManager` deliberately forks only 2 workers instead of all CPUs. The reason: `mendel-resolver` caches resolution results in-process, so fewer workers mean higher cache hit rate on repeated `node_modules` resolutions. More workers would speed up parallelism but destroy this cache locality.

### Config Has a Live Legacy Branch, Not Just a Legacy Directory

`mendel-config/index.js` switches between the modern `src/` parser and the `legacy/` parser based on whether the config contains a `base-config` key. A minimal valid config can silently take the legacy path. Sol notes the `legacy/` directory exists but doesn't flag the conditional dispatch logic as a correctness hazard.

### `mendel-development-middleware` Uses a Different URL Scheme

In development, bundle URLs are `/mendel/:variations/:bundle` (human-readable variation names). In production, they are `/mendel/:hash/:bundle.js` (content hash). Sol's runtime flow describes only the production scheme. This matters because the two middleware packages are not interchangeable at the URL level.

### `mendel-exec` `instanceof` Boundary Problem

Sol covers `mendel-exec` accurately but omits the practical consequence of `vm.runInContext`: objects constructed in the VM context fail `instanceof` checks against constructors from the host Node.js context. Isomorphic code that performs type checks across the `require` boundary breaks silently in development SSR but works in production (which uses `mendel-loader` + real `require`).

### `mendel-outlet-browser-pack` Global Shim Injection

Sol's outlet description omits that `mendel-outlet-browser-pack` auto-detects whether bundle entries reference `process` or `global` and wraps the output in an IIFE with `var global=window; var process=...` shims. This is separate from the `node-libs-browser` package-level shims and happens at pack time per bundle.

### Generator Execution Is Sequential, Outlet Execution Is Parallel

Sol's phase 8/9 walkthrough implies both steps work similarly. They don't. `MendelGenerators.performAll()` runs generators for each bundle in declaration order with no parallelism. `MendelOutlets.perform()` uses `Promise.all()` across bundles. For projects with many independent bundles, generator sequential ordering is a latency cost that outlet execution avoids.

### `mendel-generator-prune` Is a Post-Generator, Not a Generator

Sol lists `mendel-generator-prune` under generators but doesn't clarify its role: it runs after all generators complete to clean up dangling dep references and normalize `expose` IDs. It is configured as a `postGenerator`, not in the `generator` slot, and runs once across all bundles in a group rather than once per bundle.

---

## What sol could sharpen

### The GST FIXME Is a Correctness Bug, Not Just a Limitation

Sol's critique identifies the `// FIXME GST can be difference for main and browser.` comment correctly but frames it as a design shortcoming. It is a confirmed correctness bug: any module that ships a `browser` field override will get an incorrect GST graph for browser bundles. The set of affected projects is not "edge cases" — it includes any project that depends on a package using browser-field remapping, which is most real-world projects.

### The `watchNextEnv` Analysis Stops at the Symptom

Sol correctly identifies that `watchNextEnv` skips production with a TODO. The root cause is `CacheManager.sync()` seeding entries across environments before their browser-specific deps are known. The production skip is not a separate problem — it is a consequence of the cache seeding correctness issue described above. Framing these as two separate problems misses their connection.

### The IPC Framing Issue Needs Qualification

Sol raises the message framing concern but hedges it as "unspecified and untested for large payloads." It should name the actual mechanism: UNIX domain sockets on Linux guarantee atomic delivery up to `PIPE_BUF` (typically 4KB or 64KB depending on kernel). Large transformed source files can exceed this. The risk is real for large projects, not just theoretical.

### Multivariate Support Gap Is Understated

Sol's critique notes "multivariate as supported" in the public API but "single-variation-at-a-time" in GST. The stronger framing: the variation walker (`MendelVariationWalker`) counts conflicts but has no policy to resolve them. A user who activates two experiments that both modify the same file gets a `conflicts` counter increment and nothing else — no error, no defined resolution behavior.

---

## What sol did better than me

### The Data Flow Walkthrough Is More Precise

Sol's `package-integration.md` traces each phase step-by-step with the actual method names and event names in sequence. My walkthrough covers the same phases but at a higher level of abstraction. Sol's version is more useful as a reference when reading source.

### The `MendelOutletRegistry` → `_noop` Detail

Sol caught that `MendelOutletRegistry.addEntry()` maps `false`-valued browser-field dependencies to a `_noop` module. I flagged the divergence between `MendelCache` and `MendelOutletRegistry` as an inconsistency but missed this specific normalization step that happens client-side.

### `mendel-config` Sub-Module Coverage

Sol itemizes every sub-module inside `mendel-config/src/` (including `shim-config.js` and `validator.js`) and explains what each does. My summary treats `mendel-config` as a black box that returns typed sub-configs. Sol's version is more accurate for someone working in the config package.

### The `MendelTrees` Sub-Module List in `mendel-core`

Sol lists `tree-walker.js`, `tree-variation-walker.js`, `tree-variation-walker-server.js`, `tree-hash-walker.js`, `tree-serialiser.js`, and `tree-deserialiser.js` with explanations. My summary of `mendel-core` describes capabilities without naming the implementing modules. Sol's version makes it clear which file to open for each concern.

### Framing `mendel-requirify` and `mendel-treenherit` as Explicitly Deprecated

Sol states these are "likely unused by any modern Mendel consumer" and that `mendel-treenherit` "should be considered deprecated." I noted they are legacy and describe what they do, but I hedged on status. Sol's direct framing is more useful for a developer deciding whether to invest in understanding these packages.
