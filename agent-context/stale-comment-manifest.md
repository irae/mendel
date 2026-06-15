# Stale Comment Manifest

Deduped review targets found by scanning docs and source comments for likely stale or implementation-divergent notes. Each item should be checked against the codebase to decide whether it is still valid, partially implemented, or obsolete.

Task summary:

-   Collected the current high-confidence stale-comment candidates from `docs/Design.md` and the Mendel pipeline/outlet code.
-   Cross-referenced them against the current architecture notes in `agent-context/03-current-state.md` and `agent-context/05-architecture-deep-dive.md`.
-   The manifest is intended as the handoff point for follow-up review work.

1. `docs/Design.md:122` - Client-side Design section is explicitly marked outdated and says it needs revision for the manifest-based implementation.
2. `docs/Design.md:473` - Comparison to other strategies section is explicitly marked historical and says it will be removed once the design is revised.
3. `packages/mendel-pipeline/src/step/waiter.js:19-21` - TODO says entries could be emitted without GST after a planned type refactor.
4. `packages/mendel-pipeline/src/step/gst/index.js:169-172` - FIXME says dependency resolution differs between `main` and `browser` runtimes.
5. `packages/mendel-pipeline/src/daemon.js:179-183` - TODO says production watch optimization is blocked by dependency/sandbox correctness concerns.
6. `packages/mendel-pipeline/src/cache/server.js:154` - FIXME says dependency serialization only includes browser runtime.
7. `packages/mendel-outlet-css/index.js:24` - TODO says CSS preprocess should be re-enabled, but the file still contains a `_preprocess()` implementation.

Notes:

-   The manifest is intentionally deduped by semantic issue, not by raw TODO count.
-   The first pass favors comments that previous analysis already flagged as possibly stale or implementation-divergent.
