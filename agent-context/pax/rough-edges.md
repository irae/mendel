# Rough Edges and Pain Points

These are specific friction points a developer new to Mendel will encounter, in rough order of how early they appear in the adoption journey.

## 1. No getting-started guide

The README points to the `examples/` directory as the starting point. The examples directory has a short README that explains how to run `npm run daemon` and `npm run development`. What it does not explain is what you need to do _before_ running the examples — what packages to install, what configuration minimum looks like for a real project, or how to structure your first variation.

A developer who wants to integrate Mendel into an existing application has no guided path. The annotated `.mendelrc` in the full example is the most useful reference that exists, but finding it requires knowing to look there.

## 2. Configuration.md is entirely empty

The file at `docs/Configuration.md` is referenced from the README as the configuration reference. It contains six section headings:

-   Path configuration
-   Variations and Variation Inheritance
-   Bundle configuration
-   Middleware configuration
-   Environment based overrides
-   Post process middleware plugin configuration

Every section is blank. The actual configuration documentation exists only inside `packages/mendel-config/README.md`, which is not linked from the main README.

## 3. Development requires two separate processes with no single-command option

Running Mendel in development requires starting the daemon (`npm run daemon` or `mendel --watch`) and the application server separately. The examples show this split, but do not explain why it exists or what happens if you start only one. There is no convenience script that starts both. A developer who runs only the server will get confusing errors or stale bundles.

## 4. Production configuration requires a full outlet swap

To switch from development to production mode, you must change every bundle's `outlet` from `javascript-bundle` (or `css`) to `manifest`. This is not obvious from the concept (why would changing the environment require respecifying every bundle?) and is easy to miss for bundles added after the initial setup. The `env.production.bundles` block in `.mendelrc` must list every bundle explicitly. There is no "switch all bundles to manifest in production" shorthand.

The full example's `.mendelrc` demonstrates this correctly, but the Configuration.md does not warn about it.

## 5. Variation directory naming collisions throw at runtime

If `variation-dirs` contains two directories and both contain a subdirectory with the same name, Mendel throws. The error message is clear, but the constraint is not documented in the configuration reference. Teams that use multiple variation roots (e.g., `./src/experiments`, `./src/themes`) need to enforce globally unique folder names across all roots. This is a silent architectural constraint that surfaces only when a collision occurs.

## 6. normalizedId conflicts in multivariate scenarios

When two variations both override the same dependency of a base file but resolve it to files at different paths (e.g., `square.js` in one variation vs `square/index.js` in another), Mendel detects a "conflict" and the bundle fails. The `ManifestValidation.md` document explains this well, but only after you encounter the error. The error message itself — "Files with same variation (base) and id (body.js) should have the same SHA" — does not make the root cause apparent. A developer who has not read `ManifestValidation.md` will spend significant time diagnosing this.

The underlying rule (variation files must use exactly the same path and extension as the base file they override) needs to be prominent in the getting-started path, not only in a troubleshooting document.

## 7. The lerna linking step may need to be run multiple times

`DEVELOPMENT.md` explicitly notes that the `pnpm lerna exec "pnpm link --global"` step for local development "might need to be run multiple times" because lerna resolves packages by dependency depth and may not complete all links in one pass. This is a known rough edge with no automated workaround documented.

## 8. Integration tests require access to private repositories

`docs/Tests.md` states: "Mendel relies on some private repositories for integration tests. Make sure you have the appropriate access in order to run integration tests." External contributors cannot run the full test suite. Only unit tests and linting are publicly runnable. This is a significant contributor experience gap.

## 9. The Roadmap is for v2; the project is at v4

`docs/Roadmap.md` describes goals for Mendel 2.0, including rollup integration and multi-core support. Both are now implemented. The roadmap has not been updated to reflect v3 or v4 changes. A reader of the roadmap cannot tell what the project's current state or future direction is.

## 10. Several package READMEs are placeholder or one-sentence

The following packages have documentation that does not meet a basic usability bar:

-   `mendel-transform-babel/README.md`: "API: WIP" — no options documented
-   `mendel-development-middleware/README.md`: one sentence, no usage
-   `karma-mendel/README.md`: one sentence ("fork of karma-commonjs with modifications"), no explanation of what was modified or how to configure it
-   `mendel-transform-buble/README.md`: two sentences and a link to the bublé project

These packages are used in the full example's test configuration. A developer following that example and encountering a problem with them has no documentation to consult.

## 11. The base variation is implicitly appended to all inheritance chains

The `base` variation is always the final entry in any variation's resolution chain. This is not a configurable option; it is hardcoded behavior. It is explained in Design.md with a comment in a YAML code block:

```yaml
# base is assumed as last item in all variations
```

It is not stated anywhere in the configuration documentation. A developer who wants to understand why a file is being pulled from the base directory when they did not declare it in the variation's folder list will not find an explanation until they read through Design.md carefully.

## 12. The base variation is implicitly appended to all inheritance chains

The `base` variation is always the final entry in any variation's resolution chain. This is not configurable; it is hardcoded. The only place this is stated is in a comment inside a YAML code block in Design.md:

```yaml
# base is assumed as last item in all variations
```

It is not stated in the configuration documentation. A developer who sees a file being pulled from the base directory when they did not declare it in the variation's folder list will not find an explanation unless they read Design.md closely. This rule also means you cannot override or exclude the base from any variation's chain.

## 13. The lerna linking step may need to be run multiple times

`DEVELOPMENT.md` explicitly notes that `pnpm lerna exec "pnpm link --global"` "might need to be run multiple times" because lerna resolves packages by dependency depth and may not complete all links in one pass. No automated workaround is documented. A contributor who runs it once and encounters broken package resolution must read DEVELOPMENT.md carefully to discover this.

## 14. The Design.md has self-marked stale sections

Two sections in `docs/Design.md` are explicitly marked as outdated or for historical purposes by the document itself:

-   "Client-side Design": "Important note: This section is outdated. [...] this section needs to be revised"
-   "Comparison to other strategies": "This section is here for historical purposes and will be removed once this design is revised"

These sections have not been removed or revised. A new reader of Design.md cannot tell which parts describe the current system and which describe abandoned approaches.
