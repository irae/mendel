# Flow map

-   `mendel-config` normalizes file config, env overrides, and path resolution.
-   `mendel-pipeline` drives build-time work: watch, cache, deps, transforms, generators, outlets.
-   `mendel-development` adds source transforms, manifest post-processing, variation matching, and require rewriting.
-   `mendel-exec` evaluates a resolved dependency graph in VM with variation-aware require.
-   `mendel-core` reads manifests in production and resolves trees/hashes per request.
-   `mendel-middleware` serves production bundles and SSR assets from manifests.
-   `mendel-development-middleware` serves on-demand dev bundles through the pipeline client.
