# Workflows

## Explicit setup and use sequence

1. `README.md` and `docs/Design.md`: keep a base source tree for the default experience.
2. `README.md`, `packages/mendel-treenherit/README.md`, `docs/Design.md`: create variation folders that mirror only the files you want to change.
3. `README.md` and `packages/mendel-config/README.md`: declare variations as ordered folder chains in `.mendelrc` or config.
4. `examples/README.md`: run a build or a development flow from the app root. The 1.x example uses `npm run build` then `npm run development`; the 2.x example uses `npm run daemon` then `npm run development`.
5. `README.md`, `packages/mendel-core/README.md`, `examples/full-example/src/server/app.js` comments: let an outside system decide the active variations, then let Mendel resolve those variations for HTML, SSR, and bundle URLs.
6. `packages/mendel-middleware/index.js` comments and `packages/mendel-core/README.md`: serve bundle routes by hash so caches and CDNs can reuse the same asset for users with the same variation set.

## Explicit development workflow

-   `examples/README.md`: development mode compiles on demand, keeps source maps on, has a slow first load, then propagates changes fast after saves.
-   `docs/Design.md`: developers should override variations in development by query string, cookies, local config, or development-only variations.
-   `packages/mendel-development-middleware/index.js` comments: the middleware lets non-bundle routes fall through so the app can do SSR and handles bundle routes itself.
-   `packages/mendel-pipeline/src/daemon.js` comments: the daemon favors the default environment first and tries to optimize for development before other environments.

## Explicit production workflow

-   `docs/Design.md`: teams can build variation bundles and publish them to a CDN without multilayer runtime resolution.
-   `docs/Design.md` and `packages/mendel-core/README.md`: teams that need per-user variation arrays or multilayer combinations use manifests and middleware for runtime resolution.
-   `packages/mendel-core/README.md`: the server resolves a variation array to a deterministic hash and dependency list.
-   `packages/mendel-core/README.md`: later requests use the hash to recover the same bundle contents without cookies on the asset request.
-   `examples/full-example/src/server/app.js` comments: SSR can request only the bundle ids it needs, and large deployments may add their own cache layer around hash results.
-   `README.md`: Mendel can support multilayer or multivariate combinations, but external systems still control which combinations run.

## Cautious inference

-   A writer should present Mendel as a sequence with two loops: developer loop to create and test variation files, then production loop to resolve user assignments into hashed asset delivery.
-   Cleanup requires deleting the variation folder, removing its configuration entry, and rebuilding. The docs call variations disposable but do not state this full sequence.
-   The repo does not give one clean "start here" path for a new adopter. Writers will need to choose one canonical path and mark the rest as advanced.
