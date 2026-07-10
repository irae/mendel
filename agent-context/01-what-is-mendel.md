# What Mendel Is

Mendel is a JavaScript build tool and runtime framework that serves experiment-specific bundles to different users without runtime conditionals and without payload overhead. Yahoo built it to run A/B tests at the scale of teams of three to thirty developers contributing to large production applications.

## The Problem It Solves

A/B testing in web applications typically lands in one of three bad places:

- **Code conditionals** (`if (experiment_A) { ... }`) accumulate as technical debt, ship dead code to every user, and resist cleanup at scale.
- **Git branches per experiment** diverge fast, conflict constantly, and cannot compose when multiple experiments run together.
- **Runtime feature flag SDKs** ship the flag library and every variant's code, then pick at request time. Users still download code they never execute.

Mendel takes a fourth path: filesystem-folder variation resolution. Each variation is a folder that mirrors the source tree, containing only the files that differ. The build merges trees virtually; nothing is written to a merged directory.

## The Core Model: Folders as Variations

```
src/                          # base (control)
experiments/new_checkout/     # variation overlay (only the deltas)
  components/header.js        # overrides src/components/header.js
  views/cart.js               # missing — falls through to src/views/cart.js
```

A file present in the variation folder wins. A file absent from it resolves through the inheritance chain to base. The developer writes only the delta.

Variations can inherit from other variations. A sub-experiment that changes one file declares its parent in `.mendelrc`:

```yaml
variations:
    new_ad_format_discreet:
        - new_ad_format_discreet # most specific
        - new_ad_format_main # parent feature
        # base appended implicitly
```

The chain is declared once, applies to every file, and is fully deterministic. The base variation is always the final entry — hardcoded, not configurable.

## The Build Pipeline

Mendel v2+ runs as two cooperating processes connected by a Unix socket.

**Daemon** (`mendel-pipeline`): a long-running process that watches files, runs file-level transforms, resolves dependency graphs, and holds an in-memory cache per environment.

**Client** (build CLI, dev middleware, or test runner): a short-lived process that connects to the daemon, receives the processed cache, then runs generators and outlets to write final artifacts.

Inside the daemon, each environment runs its own pipeline:

```
Initialize → FileReader → IST → Waiter → GST → End
```

- **Initialize** bridges `MendelCache.entryAdded` events into the chain.
- **FileReader** reads source bytes from disk.
- **IST** (Independent Source Transform) applies per-file transforms — Babel, Bublé, UglifyJS, LESS — in a worker pool, then runs `mendel-deps` to detect `require`/`import` literals and `mendel-resolver` to resolve them. Discovered dependencies feed back into the pipeline as new entries.
- **Waiter** holds every entry until all known entries finish IST. GST cannot start until the whole graph is known.
- **GST** (Graph Source Transform) runs transforms that need the full dependency graph: code-splitting, tree-aware operations. It walks the graph once per variation via `explorePermutation`.
- **End** marks the entry done. The `CacheServer` broadcasts completed entries to connected clients.

**Generators** then walk the client-side registry to collect entries per bundle (default entry-glob walk, `mendel-generator-extract` for code splitting, `mendel-generator-node-modules` for vendor splits, `mendel-generator-prune` for cleanup).

**Outlets** write final artifacts: `mendel-outlet-browser-pack` emits browser-ready JS, `mendel-outlet-css` concatenates CSS, `mendel-outlet-manifest` writes the production manifest, `mendel-outlet-server-side-render` extends the manifest outlet with individual per-file output for SSR.

## Two-Process Development

`mendel --watch` starts the daemon. `mendel-development-middleware` mounts in the application server, connects to the daemon, receives live entries, and serves bundles on demand. The daemon caches transformed files; only changed files re-run their transforms.

The design document commits to a 300ms file-save-to-visible-change target, including SSR.

Development bundle URLs use the human-readable scheme `/mendel/:variations/:bundle`. Production URLs use a content hash (see below). The two middleware packages are not interchangeable at the URL level.

## Production Serving

At build time, `mendel-outlet-manifest` writes JSON manifests containing pre-transformed source for every variation of every file, indexed by `normalizedId` (the file path stripped of variation prefix and extension). At server startup, `mendel-core` loads all manifests into memory.

Per request:

1. Application code calls `req.mendel.setVariations(['cart_sidebar'])`.
2. `MendelTrees.variationsAndChains()` expands those IDs into lookup chains: `[['experiments/cart_sidebar'], ['src']]`.
3. `findTreeForVariations(bundleId, chains)` walks the manifest via `MendelVariationWalker`, picks the best variation match per module by chain priority, and computes a SHA over the chosen content.
4. The hash becomes the bundle URL: `/mendel/:hash/:bundle.js`.
5. When the browser requests that URL, `findTreeForHash` reconstructs the tree (binary-serialized via `concentrate`/`dissolve`) and streams the response through `browser-pack`.

The hash encodes the Mendel protocol ID, a version byte, variation indices, file count, and a SHA1 of all file contents. It carries no experiment names, no user identifiers, no cookies. The same URL serves every user in the same variation combination, so CDNs cache it with no `Vary` header. Responses ship with `max-age=31536000` — permanent cache. Changing one file in one variation busts only the bundles that include that file; every other cached URL stays valid across deploys.

## SSR

For isomorphic rendering, `mendel-outlet-server-side-render` writes each transformed source file individually. `mendel-loader` creates a `MendelResolver` that patches Node's `require()` to redirect calls to the correct variation file per request. The server renders the user's variation, and the client hydrates with the matching bundle URL — no manual coordination between server-side and client-side experiment evaluation.

In development, `mendel-exec` substitutes for `mendel-loader` by executing modules inside a Node.js `vm` context with a custom variation-aware `require`. The `vm` boundary creates an `instanceof` hazard: objects constructed inside the VM fail `instanceof` checks against constructors from the host context — a known pain point for isomorphic code that does cross-boundary type checks. Production (which uses `mendel-loader` and real `require`) is unaffected.

## What Mendel Does Not Do

Mendel does not assign users to experiments and does not measure outcomes. Those belong to external tools (PlanOut, Optimizely, any analytics stack). Its scope: given a set of active variation names for a user, produce the correct code bundle, correctly and fast.

## Version Landscape

| Era  | Status                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| v1.x | Stable. Browserify plugin. `planout-example` demonstrates it.                 |
| v2.x | Introduced daemon/client architecture, multi-core support, pluggable plugins. |
| v4.x | Current. Updated hash algorithm raises variation limit from 255 to 65k+.      |

The monorepo holds packages a user touches directly: `mendel-pipeline` (daemon and build client), `mendel-core` (production runtime resolver), `mendel-middleware` (Express production middleware), `mendel-development-middleware` (dev middleware), `mendel-config`, the `mendel-transform-*` plugins, the `mendel-outlet-*` writers, the `mendel-generator-*` collectors, plus `karma-mendel` and `mendel-mocha-runner` for variation-aware testing.
