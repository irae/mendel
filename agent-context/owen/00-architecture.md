# Mendel Architecture

## Facts

-   Mendel is a monorepo for experimentation-aware bundling and request-time resolution.
-   `mendel-config` normalizes `.mendelrc`, `package.json`, or programmatic options into one config shape.
-   `mendel-pipeline` runs the build system.
-   `mendel-pipeline/src/daemon.js` owns the long-lived cache, watcher, transformer, dependency resolver, and socket server.
-   `mendel-pipeline/src/cache/*` syncs entries between daemon and client.
-   `mendel-pipeline/src/client/*` runs generators and outlets after sync.
-   `mendel-core` resolves prebuilt manifests into trees for variation arrays or hashes.
-   `mendel-middleware` serves hash-addressed bundles from `mendel-core`.
-   `mendel-development-middleware` serves live variation bundles from the client registry.
-   `mendel-development` holds shared dev-only helpers for registry, manifest, and variation handling.

## Control Flow

-   Config loads first.
-   The daemon builds and caches entries per environment.
-   The cache server streams entries to clients.
-   Clients run generators to shape bundles.
-   Outlets serialize bundles as JS, CSS, or manifest files.
-   Runtime middleware resolves a request either from a variation route or from a hash route.

## Data Flow

-   Source files become entries.
-   Entries carry normalized ids, runtime, variation, source, map, and dependency edges.
-   Generators move entries across bundle boundaries.
-   Outlets convert entries into serialized bundle payloads.
-   Manifests preserve the data needed for deterministic tree reconstruction.
