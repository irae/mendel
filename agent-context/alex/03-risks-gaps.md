# Risks And Gaps

## Contradictions and stale language

-   `README.md` says Mendel 1.x is stable and points readers to examples because docs are short.
-   `docs/Roadmap.md` and `packages/mendel-pipeline/docs/DEVELOPMENT-README.md` talk about Mendel 2.0 or v2 as future architecture.
-   package changelogs show `4.0.0-alpha.4` in April 2024. The repo mixes at least three eras of product language.
-   `docs/Design.md` marks some sections as outdated.
-   `examples/planout-example/README.md` still has `_TBD` language.

## Terminology drift

-   The docs switch between `variation`, `experiment`, `bucket`, and `folder`.
-   The docs switch between `multivariate` and `multilayer` and sometimes treat them as neighbors, sometimes as separate needs.
-   Pipeline and core docs use `normalizedId` for matching files and detecting conflicts, but the root user path does not define it.
-   `README.md` leads with A/B testing. `Mendel.md` broadens the story to white-labeling, themes, settings, and build performance.

## Likely confusion for a new user

-   `docs/Configuration.md` is mostly headings. It does not teach real setup.
-   `packages/mendel-config/README.md` shows a large config example, but it does not anchor that example in a short end-to-end task.
-   `README.md` promises simple daily use, but the setup story still leans on examples, old Browserify terms, and multiple package entry points.
-   `packages/mendel-core/README.md`, `packages/mendel-middleware/README.md`, and `packages/mendel-development-middleware/README.md` imply different starting points. The repo does not say which path a new adopter should choose first.

## Questions for a later writer

-   Which package is the primary adoption surface now: CLI, middleware, pipeline, or a package mix?
-   Which configuration fields does a minimal project require?
-   How should a team connect its assignment service and analytics system?
-   Which file layout supports nested inheritance and layered experiments?
-   How should a team retire production variation assets and cached bundles?
-   Is SSR a core Mendel story or an advanced mode that many users can skip?
-   Should current docs treat Browserify-first language as the main product story or as historical architecture?
-   Should white-labeling and environment-specific variants sit beside experimentation in the lead narrative, or under a secondary use-cases section?
