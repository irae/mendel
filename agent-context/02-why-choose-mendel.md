# Why Choose Mendel

## 1. Zero Payload Overhead, by Construction

Mendel generates separate bundles per variation. A user assigned to `bucket_A` downloads only the modules `bucket_A` references. No byte is wasted on code paths that user will never execute, not even as dead code waiting for a minifier.

This is not a configuration option. It follows directly from the model: separate folders produce separate dependency graphs produce separate bundles. Compare to runtime flag SDKs (LaunchDarkly, Unleash), dynamic `import()` plus feature flags, or Module Federation — every one of them ships the flag library, the loader wrapper, or the federation shell to every user.

## 2. CDN Caching Without `Vary` Headers

Bundle URLs are content hashes. The hash encodes the Mendel protocol ID, a version byte, variation indices, file count, and a SHA1 over the file contents. The URL contains no experiment names, no user identifiers, no cookies. Any user in the same variation combination gets the same URL. CDNs cache it globally with `max-age=31536000` and no `Vary` configuration.

When a deploy changes one file in one variation, only the bundles that include that file get new hashes. Every other cached URL stays valid across deployments.

## 3. Experiment Disposal Is `rm -rf`

Cleanup is a directory deletion. No grep across files for `if (experimentName)` blocks, no risk of leaving a stale conditional, no parser-based dead code elimination. The variation folder is self-contained. Delete it; Mendel stops including it in builds.

Yahoo identified the cost of experiment cleanup as the primary driver of accumulating technical debt before Mendel existed. The folder model addresses it structurally, not procedurally.

## 4. Variation Inheritance for Composable Experiments

A variation declares its parent chain in `.mendelrc`. A sub-experiment that changes one button color on top of a ten-file feature variation contains exactly one file. Resolution walks the chain deterministically:

```yaml
variations:
    new_feature_variant_b:
        - new_feature_b # one file (the button)
        - new_feature # the other nine files
        # base implicit
```

No duplication. No per-file conditional ordering ambiguity. The same chain applies to every file. webpack, Vite, Rollup, esbuild, Parcel — none of them have any analogue.

## 5. Multilayer Experiments Without Team Coordination

Without layers, every experiment shares 100% of users and teams must negotiate allocation. Mendel supports independent layers: a user assigned to `L1-B` and `L2-C` receives a bundle that correctly merges both variations, computed on-demand from a pre-built manifest.

The combinatorics matter: 40 experiments across 5 layers produce 6,720 permutations. Mendel does not pre-build 6,720 bundles. The manifest holds each variation's unique modules; the middleware composes permutations at request time and the content hash makes each composition cacheable.

## 6. Secure URLs

A determined user inspecting network traffic cannot read experiment names from bundle URLs, cannot enumerate which experiments exist, and cannot compare bundles to infer business hypotheses. Compiled production bundles also contain no string references to variation names — not even as inert constants. Source maps in development do expose mnemonic folder names; that information is absent from production.

## 7. SSR That Matches the Client, Automatically

`mendel-loader` patches Node's `require()` to redirect modules to the correct variation file per request. The server renders the user's assigned variation; the HTML it emits references the matching client bundle URL. Server and client load identical code by construction.

Flag-based systems require the developer to coordinate server flag evaluation with client flag evaluation. That coordination is a common source of hydration mismatch bugs. Mendel removes the failure mode.

## 8. Synchronous, Zero-I/O Production Resolution

`mendel-core` loads manifests into memory at process startup. Per-request resolution reads no files and makes no network calls. The walker resolves each module by chain priority through the in-memory tree. Latency is sub-millisecond — proportional to the number of active experiments, not the size of the codebase.

## 9. Any File Type Participates

CSS, LESS, JSON, images — any file the bundler can process follows the same folder-override pattern. A variation can ship a different `theme.json`, a different `logo.png`, or a different `styles.css` by placing it in the variation folder. Conditional-based approaches are JavaScript-only by design.

## 10. Standard Tooling Just Works

The filesystem model means the entire Unix and git toolchain applies without modification:

-   `git diff experiments/new_ad_format src/` shows exactly what the experiment changed
-   `grep -r "CartWidget" experiments/` finds every experiment touching a component
-   Browser DevTools source maps show files under mnemonic experiment folder names

A new engineer needs to learn nothing Mendel-specific to read, diff, or audit experiment code. That lowers the onboarding cost of every team adopting it.

## 11. Battle-Tested at Scale

Yahoo ran this pattern in production starting around 2014 across teams of three to thirty contributors on large applications. The filesystem variation strategy proved stable across that period. Mendel as an open-source package codifies what worked.

## 12. Fast Cold Start and Fast Refresh

Mendel beats webpack and most comparable builders on cold start. The daemon/client split keeps the transformation pipeline warm across CI builds, dev servers, and test runners. A second client connects to an already-populated cache instead of restarting the world. `BaseMasterProcess` forks up to CPU-count IST workers (`packages/mendel-pipeline/src/multi-process/base-master.js`), so file transforms run in parallel from the first second of build.

Refresh stays fast because the cache keys each entry by id and tracks `done` state per entry (`packages/mendel-pipeline/src/cache/index.js`, `cache/entry.js`). `FsWatcher` reacts to a file change by removing and re-adding only the touched entries (`packages/mendel-pipeline/src/fs-watcher/index.js`); every other entry stays processed in the cache. The pipeline reprocesses what changed, not the project.

This pattern has powered Yahoo properties in production and development for years. Cold start and incremental refresh are strengths of the architecture, not gaps.

## When Not to Choose Mendel

-   Fewer than two or three simultaneous experiments and a small team. A flag SaaS has lower setup cost.
-   A hard requirement for webpack-specific features (Module Federation, webpack HMR). Mendel's foundation is Browserify, and hot-reload is a missing feature rather than a shipped one. The cache architecture supports it; the integration has not landed.
-   A need for experiment assignment and analytics bundled into one tool. Mendel handles only the build-and-serve side.
