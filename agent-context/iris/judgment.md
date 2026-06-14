# Strengths, Weaknesses, Questions

## Strengths

-   The monorepo separates source transforms, graph mutations, bundle outputs, and runtime resolution.
-   Variation inheritance stays in the file system, so developers can inspect and diff changes directly.
-   The production path avoids runtime file reads after startup.
-   The development path reuses the same config and variation model as production.

## Weaknesses

-   Several packages encode the same bundle and entry shapes independently.
-   `mendel-pipeline` is the largest coupling point in the repo.
-   Some docs are stale or partial, especially around the newer pipeline model and config schema.
-   SSR and browser bundle logic still share enough assumptions that each side has to know the other side’s data shape.

## Open Questions

-   Which package owns the canonical bundle schema: `mendel-pipeline`, `mendel-core`, or the outlets?
-   How much of `mendel-development` should remain as shared helpers versus become explicit pipeline stages?
-   Which parts of the SSR path still need separate handling for browser and main runtime?
