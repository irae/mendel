# sol's notes for dex

## What dex missed

**The GST runtime-field bug.** `gst/index.js` has a comment: `// FIXME GST can be difference for main and browser.` The GST traversal uses only `main` runtime dependencies to build the dependency graph. Any module that has different browser-field deps than main-field deps will cause GST to produce incorrect output for browser bundles. This is not a theoretical edge case — any package with a `browser` field that remaps a dependency will trigger it.

**The `watchNextEnv` production skip is a correctness hole, not just a TODO.** The daemon's `watchNextEnv()` returns early with `if (nextEnv === 'production') return`. The comment attributes this to "deps being different and cache not creating a perfect sandbox." This means if browser-field deps diverge between development and production environments, the cache can silently return wrong entries. It's a known-but-unresolved correctness issue, not just an optimization gap.

**Three parallel entry stores with no shared abstraction.** `MendelCache`, `MendelRegistry` (wrapper around MendelCache), and `MendelOutletRegistry` (client-side) all maintain their own `normalizedId → entry[]` secondary index. dex named the first two; the `MendelRegistry` layer adds a third. Any subtle difference in how they handle edge cases creates silent divergence between what the daemon processed and what outlets act on.

**The IPC protocol has no message framing and no versioning.** The daemon and client communicate over a Unix socket with raw `JSON.stringify`/`JSON.parse`. There is no length prefix, no delimiter protocol, and no version field in messages. Large entries (heavy source files) could fragment across reads. More critically, if the daemon changes `serializeEntry()`, the client receives malformed data with no error — there is no contract enforcement on either side.

**`CacheManager.sync()` seeding.** When a new environment pipeline starts (e.g., a test client connects), `CacheManager.sync()` copies already-processed entries from existing environment caches rather than re-processing them. This is the optimization that makes multi-environment daemon support practical. It's also where the correctness concern from the production skip above becomes concrete: if the seed copies entries whose deps differ per environment, the new environment cache starts with wrong state.

**The manifest carries build-time transforms that make it environment-specific.** `mendel-outlet-manifest` applies UglifyJS and Babel env-inlining at write time by default (`uglify: true`, `envify: true`). The manifest written to disk is already minified and has `process.env.*` literals replaced with values from the build environment. This makes the manifest unsuitable for reuse across environments without full regeneration. A clean manifest (source + deps only) with post-process minification would be more reusable.

**`node-libs-browser` is hard-coded and unmaintained.** `ShimConfig` pulls `node-libs-browser` as the default shim set. That package targets Node.js APIs circa 2016 and is now unmaintained. Projects that need modern replacements (e.g., `buffer` v6+) must manually override each shim in config. There is no package-level hook to substitute the whole shim set.

**`mendel-treenherit` depends on packages not used elsewhere in v4.** It pulls `async@^1.x`, `browser-resolve`, and `browserify-transform-tools`, none of which appear in the rest of the monorepo. It is almost certainly unused by any v4 consumer and should be deprecated.

**Multivariate support is inconsistent between API and pipeline.** `MendelVariationWalker` tracks a `conflicts` counter for multi-variation module resolution. But `GST.explorePermutation()` has a comment: `// We do not yet support multi-variation.` and processes one variation at a time. The middleware API allows setting multiple variations; the GST step doesn't handle them.

## What dex could sharpen

**The "CacheClient no back-pressure" weakness needs a sharper consequence.** dex identified that messages queue with no throttle. The sharper point is that the client's in-memory registry grows unboundedly until `sync`, and if the daemon sends entries faster than the client can index them, the client's event loop starves and outlet writes are delayed — making the daemon's `totalEntries` counter a lagging signal for when the client is actually ready.

**"Registry walk() uses prototype-level side effects" is the right finding but the framing is off.** It's not prototype-level — it's entry-object-level mutation during a shared traversal. The real risk is that if two generators share the same entry objects (which they do via the same registry), one generator's `entry.expose` mutation is visible to a subsequent generator before it's cleared. The coupling is temporal, not structural.

**The serial generator weakness needs the consequence named.** dex noted generators run in declaration order with no parallelism. The sharper consequence: for a project with 10 independent bundles, 9 of them wait while the first bundle walks its (possibly large) dependency graph. The `doneBundles` dependency between generators is real for extract/node-modules, but most bundles in practice have no such dependency.

**The "Unix socket only" weakness undersells the actual constraint.** dex noted Docker environments can't use Unix sockets. The sharper point: even in same-machine Docker, the socket path (`.mendelipc`) must be volume-mounted if daemon and client run in separate containers. This is a non-obvious operational requirement that breaks "just run mendel" assumptions in containerized CI.

**The brute-force permutation exploration needs the scale numbers.** O(files × variations) is correct, but the concrete problem is that a project with 200 files and 50 active experiments triggers 10,000 GST graph walks on every file change in watch mode (because any change resets `_canceled` and replays the entire GST). Memoizing per-variation subgraphs would make watch-mode GST cost proportional to what actually changed.

## What dex did better than me

**Named the DepsManager 2-worker cap as a deliberate insight.** I noted the worker pools existed but didn't call out the specific count or its rationale. dex named it directly and explained the cache-hit-rate reasoning. That's the right level of specificity.

**Explicit entry lifecycle table in `package-integration.md`.** dex's table mapping pipeline stage to properties added to the entry object is cleaner and more scannable than my phase-by-phase prose. The `istSource`/`istDeps` snapshot row (which I missed) shows that after IST, those fields are preserved as a first-pass snapshot that GST starts from — which is important for understanding how GST mutations relate to IST output.

**Named `_noop` mapping for false-valued browser deps.** In the client reception phase, dex noted that `MendelOutletRegistry` maps false-valued browser dependencies to `'_noop'`. I described the `false`-valued exclusion pattern on the daemon side but didn't track how the client represents it. That's a concrete data contract detail.

**Cleaner dependency graph in `package-integration.md`.** dex's dependency graph section shows who consumes whom more directly (consumed-by arrows rather than depends-on arrows). For understanding integration, the consumer direction is more useful than the dependency direction — it answers "what breaks if I change this package?"
