# pax's notes for ren

## What ren missed

**CLI reference gap** — ren's `documentation-gaps.md` does not mention that no CLI reference exists for the `mendel` command. The Roadmap explicitly called out "CLI use" documentation as a v2.0 goal that was never written. This is a critical gap because users discover `mendel --help` but have no man-page equivalent or doc equivalent.

**MENDEL_ENV vs NODE_ENV interaction** — ren's `rough-edges.md` does not cover the undocumented precedence between `MENDEL_ENV` and `NODE_ENV`. The full-example test scripts use both (`MENDEL_ENV=test`), but no document explains which takes precedence when both are set or what the recommended CI practice is.

**Types vs v1 transforms conceptual gap** — ren does not identify that the v2 `types:` configuration key is a conceptual replacement for per-bundle Browserify transforms in v1. A user migrating from v1 will not understand why `types:` exists or what it replaces. This belongs in the migration guide and in the types documentation.

**mendel-middleware production API** — ren's `documentation-gaps.md` omits `mendel-middleware` as a package with no standalone API documentation. `mendel-core/README.md` explicitly tells users to "see `mendel-middleware` for a production ready implementation," but no README for `mendel-middleware` exists. This leaves users without guidance on how to mount it in Express or what options it accepts.

**Multilayer usage example missing** — ren does not note that the `full-example` never demonstrates a multilayer configuration. Design.md explains the architecture and exponential permutation problem, but no user-facing document shows what a multilayer `.mendelrc` looks like or how the production server handles a user assigned to variations from multiple layers simultaneously.

**Outlet and generator option gaps** — ren's package documentation table omits `mendel-generator-extract` and `mendel-generator-node-modules`. Both are used in the full example but have no option documentation. Users must read source code to discover available options like `css` outlet `plugin: autoprefixer` or SSR outlet `requireTransform`.

**Bundle hash anatomy** — ren describes the bundle hash as "opaque" but does not detail what it encodes. The hash contains the Mendel protocol ID, a version byte, variation indexes, total file count, and a SHA1 of all file contents. This matters for the CDN-safe and cache-precise properties ren cites without full justification.

## What ren could sharpen

**Production outlet swap explanation** — ren's rough-edges item on the outlet swap correctly identifies the friction but does not explain what happens if you omit it. That consequence — bundles continue to be generated in development mode, meaning no CDN-serializable manifests — is what makes this error costly in production. Name the failure mode, not just the required step.

**Design.md stale section risk** — both agents flag the stale sections in Design.md. Ren's version is accurate but does not specify which section is most dangerous. The "Client-side Design" section is the highest risk because it describes a pre-manifest bundling approach that no longer reflects the current system. A new user reading it will build a wrong mental model of how production serving works.

**Rough-edge item for the daemon requirement** — ren's item 3 says "there is no convenience script that starts both." This is accurate but understates the friction. The confusing errors a developer gets when only the server runs (stale bundles, no bundles) are the actual pain. Name those symptoms.

**Variation inheritance in what-is-mendel** — ren's example is clear, but the `base is always appended implicitly` rule is not stated in the what-is-mendel explanation. Ren found this as a rough edge correctly, but the architectural explanation in what-is-mendel should state it upfront so the rough-edge feels like a documentation failure rather than a feature behavior.

## What ren did better than me

**Pipeline step sequence** — ren named the pipeline as `FileReader → IST → GST → Generator → Outlet` in what-is-mendel. Pax described the daemon/client split without naming the step sequence. The sequence is the clearest way to explain what each pipeline concept does and in what order.

**Dev-mode variation override** — ren captured that Mendel supports variation override via query string, cookie, and developer box configuration in development. Pax missed this entirely in why-choose-mendel. It is a meaningful developer ergonomics feature.

**Failure modes of competing approaches** — ren's "Proven at scale" section named the specific failure modes of git branches, code conditionals, and runtime feature flags. Pax wrote vaguely about "failure modes at scale." Ren's specificity makes the comparison actionable.

**Base-implicit-append as a rough edge** — ren identified that the base variation being silently appended to all inheritance chains is undocumented behavior. Pax missed this entirely. It is a genuine gotcha for any developer who wants to understand why a file resolves from base when they did not put it there.

**Lerna multi-run requirement** — ren found that DEVELOPMENT.md explicitly warns the linking step "might need to be run multiple times." Pax missed this. It is a concrete contributor friction point with a specific source citation.

**Testing variations gap** — ren identified that no document explains how to write tests against specific variations. Pax missed this. The full example uses mendel-mocha and karma-mendel, but without documentation these are cargo-culted from the example rather than understood.
