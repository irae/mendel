# What Is Mendel

## One-sentence definition

Mendel is a JavaScript build tool and runtime framework for serving separate, experiment-specific bundles to different users without conditionals in source code and without payload overhead.

## The core problem it solves

A/B testing in large web apps typically lands in one of two bad places:

-   **Conditionals in code** — `if (experiment_A) { … }` — accumulates tech debt, ships dead code to users, and is nearly impossible to clean up at scale.
-   **Git branches per experiment** — diverges fast, conflicts constantly, cannot compose.

Mendel takes a third path: **file-system-based variation resolution**. Each experiment is a folder that mirrors the source tree, containing only the files that differ. Mendel merges folders at build/request time; the merged tree never touches disk.

## How it works

### Source structure

```
src/             ← base (control) variation
experiments/
  new_ad_format/ ← only the files that differ for this experiment
    views/
      ads.js
    controllers/
      sidebar.js
```

Any file absent from `experiments/new_ad_format/` is served from `src/`. The developer writes only the delta.

### Build output

Mendel generates bundles for every declared variation. In production, all variations are compiled ahead of time and serialized to manifest files. At request time:

1. Server reads the user's experiment assignment from a cookie.
2. `mendel-core` walks the in-memory manifest and produces a deterministic hash for that combination.
3. The hash becomes the bundle URL — no experiment names, no cookies required on the asset request.
4. The CDN caches the URL safely for all users sharing the same combination.

### Build pipeline

The Mendel v2+ pipeline runs in two tiers:

-   **Daemon**: long-running process that watches source files and runs Independent Source Transforms (IST: Babel, Bublé, UglifyJS, LESS). Holds a per-environment file cache.
-   **Clients**: short-lived processes that consume the daemon's cache to run Graph Source Transforms (GST), then invoke Generators and Outlets to write final artifacts.

Pipeline order:

```
FileReader → IST → GST → Generator → Outlet
```

**Types** map file extensions to transform chains. **Generators** perform graph-level operations (extract node_modules into a vendor bundle, split for lazy loading). **Outlets** define output format: browser-pack JavaScript, CSS, SSR artifacts, or the production manifest.

### Development mode

A daemon process (`mendel --watch`) watches the source tree and runs IST transforms. A separate dev-middleware serves bundles on demand. First load compiles; subsequent saves propagate changes within milliseconds. The design document targets file-save to visible change in under 300 ms, including server-side rendering.

## Key capabilities

| Capability                      | What it means                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Variation inheritance           | Experiment B can declare that it inherits from experiment A, adding only its own delta on top                                    |
| Multilayer experiments          | Users can be assigned to experiments from independent layers simultaneously — different teams own different layers               |
| Server-side rendering           | `mendel-resolver` lets Node.js `require()` the correct variation of each module per request                                      |
| Any filetype                    | CSS, JSON, LESS, and images follow the same folder-based variation resolution as JavaScript                                      |
| Environment-specific transforms | `.mendelrc` supports `env:` overrides so development, production, and test use different transform chains                        |
| Bundle splitting                | Generators (`mendel-generator-node-modules`, `mendel-generator-extract`) split output into vendor, lazy, and application bundles |

## What Mendel does not do

Mendel does not assign users to experiments. It does not measure outcomes. Those responsibilities belong to external tools (PlanOut, Optimizely, or any analytics stack). Mendel's scope is: given a set of active variation names for a user, produce the correct code bundle for that user, correctly and fast.

## Version landscape

| Era        | Status                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Mendel 1.x | Stable, used in Yahoo production. Browserify-based. `planout-example` demonstrates it.                                              |
| Mendel 2.x | Introduced daemon/client architecture, multi-core support, pluggable transforms/generators/outlets. `full-example` demonstrates it. |
| Mendel 4.x | Current release. Increases variation limit from 255 to 65k+ via updated hash algorithm.                                             |

## Package structure

Mendel is a monorepo. Core packages a user interacts with:

-   `mendel-pipeline` — the build daemon
-   `mendel-core` — production runtime resolver
-   `mendel-config` — configuration normalization (`.mendelrc` or `package.json`)
-   `mendel-transform-babel` — Babel IST
-   `mendel-outlet-browser-pack` — JS bundle output (development)
-   `mendel-outlet-manifest` — serialized manifest output (production)
-   `mendel-outlet-server-side-render` — SSR artifact output
-   `mendel-generator-node-modules` — splits node_modules into a separate bundle
-   `mendel-generator-extract` — code splitting / lazy bundles
-   `karma-mendel` — Karma test runner integration
