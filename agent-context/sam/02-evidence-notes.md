# Evidence notes

## Supported claims

-   Mendel builds and serves client-side JavaScript bundles for experiments. `README.md`
-   Mendel does not do random assignment or experiment measurement. `README.md`
-   Mendel supports SSR and multilayer experiments. `README.md`, `docs/Design.md`
-   Mendel uses folder overlays for variation resolution. `README.md`, `docs/Design.md`, `packages/mendel-core/README.md`
-   `mendel-development-middleware` serves development bundles and lets SSR continue when the request is not a bundle route. `packages/mendel-development-middleware/index.js`
-   Configuration can come from `.mendelrc`, `package.json`, or options. `docs/Configuration.md`, `packages/mendel-config/index.js`
-   Production bundle URLs use hashes. `packages/mendel-core/README.md`
-   `mendel-core` resolves a variation set to a tree, then can recover the same tree from a hash. `packages/mendel-core/README.md`

## Inference

-   The clean user path is idea -> variation folders -> config -> development server -> bundle build -> hashed production serving -> remove variation files and config later. This sequence is stitched together from separate docs and comments.
-   Rollout still needs an external assignment system because Mendel does not provide one.
-   Cleanup is a manual file-and-config delete flow because no explicit deprecation workflow appears in the docs.

## Documentation traps

-   The docs mix `variation`, `bucket`, `experiment`, and `layer`. Users need to learn that these terms overlap but are not always identical.
-   `normalizedId` is central but underexplained outside `mendel-pipeline` and `mendel-core`.
-   The root README points new users at the examples, which is correct, but the examples split across Mendel 1.x and 2.x paths.
-   Some docs say the result tree is not written to disk, while later pipeline docs describe a daemon/client build system. The user-facing meaning is the same, but the wording changes across generations.
-   The configuration docs are a stub in places. `docs/Configuration.md` still has empty section headings.

## User questions left open

-   How does a team wire Mendel into its own assignment service?
-   How does a team wire Mendel into analytics or outcome tracking?
-   Which config fields are required for a minimal real project?
-   Which features belong to Mendel 1.x only, and which belong to the newer pipeline?
-   What exact file layout does the user need for nested variations and layered experiments?
-   What is the supported cleanup story for production bundles and caches?
