# Product Frame

## Explicit evidence

-   `README.md`: Mendel is a framework for building and serving client-side JavaScript bundles for A/B testing experiments in web applications.
-   `README.md`: Mendel supports variation bundle generation, isomorphic or SSR applications, multivariate or multilayer experimentation, and variation inheritance.
-   `README.md`: Mendel does not handle random assignment or experiment measurement. It points to outside tools such as PlanOut and analytics systems for that work.
-   `Mendel.md`: the repo also pitches Mendel as a way to manage white-labeling, theme support, environment or settings based features, bundle splitting, and environment-specific builds.
-   `docs/Design.md`: the product goals center on zero payload overhead for inactive variations, fast synchronous runtime resolution, disposable variation code, and hiding variation names from URLs and shipped code.
-   `packages/mendel-core/README.md`: production use includes resolving a variation list to a deterministic hash and using that hash to recover the same dependency tree later.

## Cautious inference

-   Mendel fits teams that run frequent front-end experiments in server-rendered or isomorphic apps and want to avoid runtime conditionals inside product code.
-   Mendel also looks useful for adjacent file-based variants, not only experiments. White-labeling and environment-specific UI changes appear as secondary stories, not side notes.

## Check on the README framing

-   The core claim holds: Mendel builds and serves client-side bundles for file-based variations and leaves assignment and measurement to other systems.
-   The framing is too narrow if it stops there. Repo evidence adds SSR alignment, hash-based runtime serving, dev and production middleware, variation inheritance, and multilayer combinations.
