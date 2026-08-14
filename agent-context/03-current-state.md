# Current State and Rough Edges

Mendel's model is sound. Its implementation and documentation have not kept pace. A new user encounters friction at every stage from install to production. A contributor encounters incorrect setup instructions and inaccessible test infrastructure.

## Onboarding Friction

**No getting-started guide.** The README points at `examples/`. The examples README lists two commands (`npm run daemon`, `npm run development`) but does not explain what to install for a real project, what a minimum `.mendelrc` looks like, how to add the first variation, or how to verify the build worked.

**Two processes required, never explained.** Development needs the daemon and the application server running concurrently. The README does not mention this. A developer who starts only the server gets stale bundles or confusing errors. No convenience script starts both.

**Stale contributor instructions.** The main `README.md` tells contributors to run `npm run bootstrap`. The actual workflow in `DEVELOPMENT.md` uses `pnpm install` and `pnpm lerna exec "pnpm link --global"`. The project migrated to pnpm + lerna; the README was not updated. `docs/Tests.md` references `npm run linkall`, which no longer exists. A new contributor following the README cannot set up a dev environment.

**Lerna linking may need multiple runs.** `DEVELOPMENT.md` notes that `pnpm lerna exec "pnpm link --global"` "might need to be run multiple times" because lerna resolves packages by dependency depth and may not complete all links in one pass. No automated workaround.

**Integration tests need private repo access.** `docs/Tests.md` states that integration tests require access to private repositories. External contributors cannot run the full suite. Only unit tests and linting are publicly runnable.

## Documentation Gaps

**`docs/Configuration.md` is six headings and no content.** Path configuration, variations, bundles, middleware, env overrides, post-process — all blank. The only configuration reference that exists is the heavily-commented `full-example/.mendelrc` (which conflates tutorial and reference) and `packages/mendel-config/README.md` (which is not linked from the main README).

**No CLI reference.** The Roadmap called out CLI documentation as a v2 goal. It was never written. Users run `mendel --help` and read flag names without any explanation of what they do.

**No migration guide.** Mendel has three architectural eras (v1 Browserify plugin, v2 daemon/client, v4 hash algorithm). The `.mendelrc` structure changed substantially between v1 and v2 (`variationsdir` → `variation-config.variation-dirs`; `base-config` introduced). No document maps the changes. A reader of the v1 `planout-example` looking at the v2 `full-example` sees two unrelated configurations.

**Roadmap describes v2 goals; project is v4.** Multi-core support and rollup integration are listed as aspirational. Both shipped. A reader using the Roadmap to understand current capability gets a wrong impression — they may conclude Mendel is single-threaded and choose a different tool.

**`Design.md` has self-marked stale sections that nobody removed.** Three sections carry notes saying "this section is outdated" or "needs reviewing." The Client-side Design section is the most dangerous: it describes a pre-manifest bundling approach that no longer reflects how production works. A new reader cannot tell which parts of the document are current.

**Variation inheritance shown twice in two syntaxes.** Design.md presents the original JSON syntax and the current YAML syntax side by side with a "needs reviewing" note. No document says which is current.

**No troubleshooting guide beyond one error.** `docs/ManifestValidation.md` covers the SHA-mismatch error well but is not linked from the README or Configuration.md. A developer searching for the error finds the source code that emits it, not the explanation. Common failure modes have no docs at all: daemon not running, variation folder collisions across roots, SSR resolving the wrong variation, hash mismatch returning 404, `normalizedId` conflicts.

**No glossary.** A first-time reader meets: variation, bucket, layer, IST, GST, generator, outlet, manifest, daemon, client, normalized ID, entry, tree, bundle, base. A glossary exists only in `packages/mendel-pipeline/docs/DEVELOPMENT-README.md` — the internal developer doc, not a user-facing one.

**Empty or one-sentence READMEs in packages users touch.** `mendel-transform-babel`: "API: WIP". `mendel-development-middleware`: one sentence. `karma-mendel`: "Fork of karma-commonjs with modifications." `mendel-outlet-server-side-render` and `mendel-mocha-runner` have no README at all. `mendel-middleware` — the production-ready wrapper that `mendel-core`'s README explicitly directs users to — has no standalone documentation. Users must read source code to discover options like the CSS outlet's `plugin: autoprefixer` or the SSR outlet's `requireTransform`, `includeNodeModules`.

## Configuration Gotchas That Surface as Errors

**Production requires switching every outlet to manifest.** To switch from development to production mode, every bundle's `outlet` must change from `javascript-bundle` (or `css`) to `manifest` in `env.production.bundles`. There is no shorthand. A bundle added after initial setup will silently ship in development mode. The full example demonstrates the swap; Configuration.md does not warn about it.

**Variation folder names must be globally unique across `variation-dirs`.** Mendel uses folder names as variation identifiers. A name appearing in two roots throws at runtime. The constraint is not documented in the configuration reference.

**`normalizedId` conflicts produce a misleading error.** If two variations resolve the same logical module to different paths (`square.js` vs `square/index.js`), Mendel throws: `Files with same variation (base) and id (body.js) should have the same SHA`. The error mentions SHA — pointing developers toward content mismatch — but the root cause is path mismatch. `ManifestValidation.md` explains this but the user has to know that document exists.

**The base variation is silently appended to every chain.** It is hardcoded, not configurable. A developer who sees a file resolved from base when they did not declare it has no user-facing document explaining why. The only mention is a YAML comment in Design.md: `# base is assumed as last item in all variations`.

**`MENDEL_ENV` vs `NODE_ENV` precedence is undocumented.** `mendel-config/README.md` names both. The full-example test scripts use both (`MENDEL_ENV=test`). No document explains which wins when both are set or what to do in CI.

## Development Workflow Pain

**Variation override mechanisms are undocumented.** Design.md says variations can be overridden in development via query string, cookie, or developer-box configuration. None of these mechanisms are documented as user-facing features. The full example presumably implements them in server code; there is no reference for how the middleware exposes them.

**Testing variations has no user documentation.** The full example uses `karma-mendel` (its earlier mocha+jsdom path was orphaned and removed in 2026-08). No document explains how to write tests against specific variations. `mendel-mocha-runner` has no README. Developers cargo-cult test setup from the example.

**Multilayer has no example.** `Design.md` explains the architecture and the permutation problem. The `full-example` does not demonstrate multilayer. No document shows what a multilayer `.mendelrc` looks like or how the production server handles a user assigned to variations from multiple layers.

## Known Architectural Weaknesses

These weaknesses are visible in the source code as TODOs or FIXMEs. They affect users in production, not just contributors.

**The GST `main`-only graph traversal is a correctness bug.** `gst/index.js` carries `// FIXME GST can be difference for main and browser.` The graph transform uses `main` runtime dependencies for graph traversal. Any module with a `browser` field that remaps a dependency triggers incorrect GST output for browser bundles. This is not edge-case territory — most real-world projects depend on packages that use the browser field.

**`watchNextEnv` skips production for unsolved correctness reasons.** The daemon's optimization to pre-warm a second environment in watch mode explicitly returns early for the production environment, with a TODO citing "deps being different and cache not creating a perfect sandbox." This is gated behind `MENDEL_BETA` and never pre-warms the environment that matters most. The root cause is `CacheManager.sync()` seeding entries across environments before per-environment browser deps are known.

**Multivariate is incomplete.** `MendelVariationWalker` tracks a `conflicts` counter when two active variations both provide a different version of the same module. There is no defined resolution policy — no error, no documented behavior. GST has an explicit comment `// We do not yet support multi-variation.` and processes one variation at a time. The middleware API allows setting multiple variations; the build pipeline does not fully handle them.

**`node-libs-browser` is hard-coded and unmaintained.** `ShimConfig` uses `node-libs-browser` as the default shim set. That package targets Node.js APIs as of 2016 and is no longer maintained. Projects needing modern replacements (`buffer` v6+, etc.) must override each shim manually with no package-level hook.

**`mendel-treenherit` is a deprecated browserify-era package still in the monorepo.** It depends on `async@^1.x`, `browser-resolve`, and `browserify-transform-tools` — none of which appear elsewhere in v4. It is almost certainly unused by any v4 consumer and creates maintenance surface.

## Maintenance Status

The repository lives under the YahooArchive GitHub organization, which signals reduced active maintenance. Modern bundler projects (Vite, Rolldown, Rspack, Turbopack) ship weekly releases backed by full-time teams. Mendel's release cadence does not match. The architecture is sound and the runtime stays fast in production; the open-source project receives fewer commits than its newer peers.
