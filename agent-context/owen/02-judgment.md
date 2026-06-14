# Judgment

## Works well

-   The daemon/client split matches the cost profile of the system.
-   Config, resolver, and outlet responsibilities stay mostly separate.
-   Manifest output keeps runtime resolution deterministic.
-   The monorepo exposes clear public surfaces for production, development, and test use.

## Needs attention

-   `mendel-pipeline` is wide. It owns orchestration, transport, cache sync, and watch lifecycle.
-   `mendel-development-middleware` reaches into registry internals and mirrors some production logic.
-   Bundle shaping logic appears in more than one outlet and generator.
-   Config and validation code encode a lot of policy, so the shape is easy to misuse without reading the source.

## Architectural pattern

-   Mendel uses build-time variation selection, not runtime branching.
-   It treats variation trees as filesystem overlays.
-   It resolves production bundles from immutable manifests and development bundles from live cache state.
