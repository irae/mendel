# Architecture

## Facts

-   Mendel uses file-system variation trees instead of runtime conditionals.
-   `mendel-config` is the shared entry point for config lookup and normalization.
-   `mendel-pipeline` owns build-time state: cache, watcher, dependency parsing, transforms, generators, and outlets.
-   `mendel-core` owns production-time tree resolution from prebuilt manifests.
-   `mendel-development` sits between source and manifest output. It rewrites requires, sorts manifests, and validates variation output.
-   `mendel-exec` runs a resolved graph in `vm` and maps variation-aware imports through `mendel-resolver`.
-   `mendel-middleware` serves manifest-backed bundles in production.
-   `mendel-development-middleware` starts a pipeline client and serves bundles on demand during development.
-   `mendel-loader` builds SSR variation maps for `mendel-middleware`.
-   `mendel-outlet-manifest` and `mendel-outlet-server-side-render` bridge build output into manifest and SSR file output.

## Control flow

-   Source files enter `mendel-pipeline`.
-   `mendel-deps` parses dependencies and resolves them with `mendel-resolver`.
-   Transforms like Babel, LESS, env inlining, Istanbul, and Uglify mutate source and sourcemaps.
-   Generators reshape the dependency graph into bundle groups.
-   Outlets serialize the final bundles or manifests.
-   `mendel-core` later loads the manifest and resolves a request-time tree from a bundle plus a variation set or hash.
-   `mendel-middleware` uses that tree to stream JS or CSS to the client.
-   `mendel-development-middleware` uses the live pipeline client and `mendel-exec` to build bundles on demand.

## Data flow

-   Config flows from `.mendelrc` or `package.json` into every package through `mendel-config`.
-   Entry metadata flows through the pipeline cache as normalized ID, variation, runtime, type, source, deps, and sourcemap.
-   Production bundles flow as manifests first, then as hash-addressed request URLs.
-   SSR flow uses the same variation map on the server and the client so `require` resolves to the same files in both places.

## Package interactions

-   `mendel-pipeline` depends on `mendel-config`, `mendel-deps`, `mendel-development`, and `mendel-resolver`.
-   `mendel-development-middleware` depends on `mendel-config`, `mendel-development`, `mendel-exec`, and `mendel-pipeline`.
-   `mendel-middleware` depends on `mendel-core` and `mendel-loader`.
-   `mendel-loader` depends on `mendel-core` output and produces a resolver for `mendel-exec`.
-   `mendel-deps` depends on `mendel-resolver` for path resolution.
-   `mendel-core` depends on `mendel-config`.

## Patterns that work

-   The repo keeps build-time and runtime resolution separate.
-   The variation model stays file-system based, so diffs stay readable.
-   Normalized IDs give the codebase a stable identity across variations.
-   The daemon/client split lets the pipeline reuse expensive transforms.
-   Generators and outlets give the build graph clear extension points.

## Patterns that leak

-   Some packages know too much about bundle internals. `mendel-middleware` and `mendel-development-middleware` both reach into bundle and variation mechanics directly.
-   `mendel-development` spreads cross-cutting helpers across many files instead of one narrow API.
-   The manifest and bundle data shapes repeat across packages, so the build graph depends on implicit contracts.
-   `mendel-pipeline` mixes long-lived daemon state, registry logic, and client build logic in one package boundary.
