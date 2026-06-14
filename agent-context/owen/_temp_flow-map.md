# Flow map

-   `mendel-config` loads and normalizes project config.
-   `mendel-pipeline` runs the daemon/client build system.
-   `mendel-pipeline/src/daemon.js` owns file watching, transforms, dependency resolution, cache fanout, and environment-specific pipelines.
-   `mendel-pipeline/src/cache/*` moves entries over a socket from daemon to client.
-   `mendel-pipeline/src/client/*` turns synced cache state into generators plus outlets.
-   `mendel-generators` choose entries per bundle and can reshape bundle boundaries.
-   `mendel-outlets` turn bundle entries into browser-pack JS, CSS, or manifest files.
-   `mendel-core` reads prebuilt manifests and resolves trees at request time from variation sets or hashes.
-   `mendel-middleware` serves hash-addressed bundles from `mendel-core`.
-   `mendel-development-middleware` serves variation-addressed bundles from the live client registry during development.
