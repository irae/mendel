# Evidence notes

## Supported claims

-   Teams use Mendel to build and serve client-side variation bundles. `README.md`
-   Mendel leaves assignment and measurement to other systems. `README.md`, `examples/planout-example/README.md`
-   Mendel supports SSR, variation inheritance, and multilayer combinations. `README.md`, `docs/Design.md`
-   The broader product story includes white-labeling, themes, settings, and environment variants. `Mendel.md`
-   Variation folders mirror changed files from the base tree. `README.md`, `docs/Design.md`, `packages/mendel-treenherit/README.md`
-   Overrides must preserve the base path and extension when they replace an existing resolution. `docs/ManifestValidation.md`
-   Nondeterministic transforms can make manifest validation fail. `docs/ManifestValidation.md`
-   Development mode compiles on demand; production mode requires rebuild and restart after source changes. `examples/README.md`
-   Production resolution maps a variation list to a hash and recovers the same dependencies from that hash. `packages/mendel-core/README.md`
-   A hash-based asset request needs no cookies or `Vary` header. `packages/mendel-core/README.md`

## Inference

-   Mendel fits teams that run front-end experiments in SSR or isomorphic applications and want to remove experiment conditionals from product files.
-   User guidance should separate the developer loop from the production request loop.
-   Cleanup requires removing variation inputs, rebuilding, and redeploying. Winning code may need promotion into base.

## Documentation risks

-   The repository mixes Mendel 1.x, a planned Mendel 2.0, v2 pipeline language, and `4.0.0-alpha.4` changelogs dated April 30, 2024. A writer cannot infer the current supported path from version numbers alone.
-   `docs/Design.md` marks part of its client-side design as outdated.
-   `docs/Configuration.md` contains empty sections. `packages/mendel-config/README.md` supplies a large example without a minimal adoption task.
-   Example READMEs give different commands for 1.x and 2.x. The PlanOut example contains a TODO.
-   A new reader cannot identify one primary entry point among CLI, middleware, core, pipeline, and package-level APIs.
-   Browserify-era package docs can look current beside newer daemon and pipeline docs.
-   Repository prose mixes `variation`, `experiment`, and `bucket`. It gives no stable relationship among `layer`, inheritance chain, and multivariate combination.
-   Readers meet experiments first in the root README. `Mendel.md` adds white-labeling and environment variants. A writer should label those as supported adjacent uses without making them the lead promise.
-   `normalizedId` matters for conflict diagnosis but adds noise to a first-use guide.

## Questions for a documentation writer

-   Which package or command should a new project install first?
-   Which version and example represent the supported product today?
-   Which configuration fields form the smallest working setup?
-   How should an application pass assignment results into Mendel in development and production?
-   Which SSR steps can client-only applications skip?
-   How should teams model variation inheritance versus independent layers?
-   How should teams promote a winning variation into base and retire old hashed bundles?
-   Which Browserify references describe supported behavior, and which record history?
