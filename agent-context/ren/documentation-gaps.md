# Documentation Gaps

Gaps are ordered by severity — how much they block a new user versus a contributor.

## Critical: Missing user-facing reference docs

### Configuration reference

**File:** `docs/Configuration.md`
**Status:** Six section headers, no content.
**Impact:** Every user must configure `.mendelrc`. The only guidance is the heavily-commented `full-example/.mendelrc`, which conflates tutorial with reference. Missing sections:

-   Path configuration (what `base-config.dir`, `variation-config.variation-dirs`, `outdir`, `bundlesoutdir` mean)
-   Full list of variation declaration options
-   Bundle configuration keys (`outfile`, `entries`, `require`, `external`, `exclude`, `ignore`, `from`, `extract-entries`)
-   Middleware route configuration (`route-config`)
-   Complete `env:` override behavior and precedence rules

### CLI reference

No document lists `mendel` CLI flags. A user running `mendel --help` gets output, but no man-page equivalent exists in docs. The Roadmap explicitly calls out "CLI use" documentation as a 2.0 goal — it was never written.

### Outlet and generator API references

The `mendel-outlet-browser-pack`, `mendel-outlet-manifest`, `mendel-outlet-server-side-render`, `mendel-outlet-css`, `mendel-generator-extract`, and `mendel-generator-node-modules` packages have no option documentation. Users must read source code or the example `.mendelrc` to discover available options (e.g., `css` outlet `plugin: autoprefixer`, SSR outlet `dir:`, `requireTransform:`, `includeNodeModules:`).

## Critical: No getting-started guide

The README points to `examples/README.md` for getting started. That file gives commands to run but no explanation of:

-   How to add Mendel to an existing project
-   Minimum `.mendelrc` configuration to get one variation working
-   What files to create
-   How to verify the build worked

The Roadmap identified "Installation guide" and "Cookbook recipe for creating a variation" as 2.0 goals. Neither exists. The design document (3,000+ words) explains the philosophy thoroughly but does not function as a tutorial.

## High: No migration guide

Mendel has had at least three significant architectural versions:

-   v1: Browserify plugin, `.mendelrc` with `variationsdir` key
-   v2: Daemon/client architecture, new pipeline, `.mendelrc` restructured with `base-config` / `variation-config`
-   v4 (current): Hash algorithm updated to 65k variation limit

No document maps what changed between versions or how to migrate. A user on v1 (the `planout-example` approach) reading the v2 `full-example` will see a completely different config structure with no explanation of why or what maps to what.

## High: Stale sections not marked as "legacy"

`docs/Design.md` contains three sections marked with notes saying the content is outdated or needs revision. These notes have existed since at least the Yahoo era. A reader cannot distinguish current architecture from historical context. Specific stale content:

1. **Client-side Design section** explicitly says "this section is outdated" and "needs to be revised." It still appears before current implementation details.
2. **Variation Inheritance** shows the original JSON syntax alongside the YAML syntax with a note saying "this section needs reviewing." Both syntaxes look equally authoritative.
3. **Comparison section** says it is "here for historical purposes and will be removed." It has not been removed.

## High: No troubleshooting guide

`docs/ManifestValidation.md` covers one specific error (`Files with same variation (base) and id should have the same SHA`). No other troubleshooting documentation exists. Common failure modes with no docs:

-   Daemon not running when dev server starts
-   Variation folder name collision across multiple `variation-dirs`
-   Node.js `require()` resolving to wrong variation in SSR
-   Hash mismatch between generation and serving (currently returns 404 with no guidance)
-   `normalizedId` conflicts in multivariate scenarios

## Medium: No glossary for new readers

A first-time reader encounters: variation, bucket, layer, IST, GST, generator, outlet, manifest, daemon, client, normalized ID, entry, tree, bundle, base. These terms are used interchangeably and contextually across multiple documents. A glossary exists only in `packages/mendel-pipeline/docs/DEVELOPMENT-README.md` (the internal developer doc), not in any user-facing location.

## Medium: `mendel-middleware` production API undocumented

`mendel-core/README.md` shows a manual server setup using `mendel-core` directly. It ends with: "Please see `mendel-middleware` for a production ready implementation." There is no README in any `mendel-middleware` package (it does not appear in the package search results). Users are told to use `mendel-middleware` for production but have no API documentation for it.

## Medium: Test infrastructure docs are incomplete and stale

`docs/Tests.md`:

-   References `npm run linkall` (does not exist in pnpm workspace)
-   States integration tests need private repository access with no workaround
-   Does not document how to run tests for a specific Mendel package in the monorepo

A contributor wanting to add tests or verify a fix in a single package has no guidance.

## Low: No explanation of multilayer from a user perspective

`docs/Design.md` explains multilayer from an architecture standpoint, including the exponential permutation problem. It does not explain:

-   How to declare layers in `.mendelrc`
-   What a user-facing layer configuration looks like
-   How the production server should handle a user assigned to variations from multiple layers

The `full-example` does not demonstrate multilayer.

## Low: No explanation of what "types" replaces from v1

The v2 configuration introduces `types:` as a way to assign transforms to file extensions. The v1 config used Browserify transforms directly. No document explains the conceptual shift or why types exist instead of per-bundle transforms. The `DEVELOPMENT-README.md` explains it internally but is not linked from user docs.

## Secondary: Missing package READMEs for packages with no documentation at all

These packages are referenced in examples and used in standard setups but have no README:

| Package                            | Current state                               | What is needed                                              |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `mendel-outlet-server-side-render` | No README exists                            | SSR setup, `requireTransform`, `includeNodeModules` options |
| `mendel-mocha-runner`              | No README exists                            | How to use `mendel-mocha` CLI                               |
| `mendel-transform-babel`           | "API: WIP"                                  | Options mapping, how to pass Babel config                   |
| `mendel-transform-buble`           | Two sentences                               | Options, deprecation status vs babel                        |
| `karma-mendel`                     | "Fork of karma-commonjs with modifications" | What the modifications are, how to configure                |
| `mendel-development-middleware`    | One sentence                                | Mount point, options, relationship to daemon                |

## Summary table

| Gap                                        | Severity | User blocked?                              |
| ------------------------------------------ | -------- | ------------------------------------------ |
| `docs/Configuration.md` is empty           | Critical | Yes — can't configure Mendel               |
| No CLI reference                           | Critical | Partial — `--help` output exists           |
| No getting-started / install guide         | Critical | Yes — must reverse-engineer examples       |
| No migration guide                         | High     | Yes for v1→v2 users                        |
| Stale Design.md sections                   | High     | Misleads on current architecture           |
| No troubleshooting guide                   | High     | Yes when hitting errors                    |
| Outlet/generator options undocumented      | High     | Partial — examples cover common cases      |
| Missing package READMEs (SSR, mocha, etc.) | High     | Blocks users of those packages entirely    |
| No glossary in user docs                   | Medium   | Slows comprehension                        |
| `mendel-middleware` production API missing | Medium   | Partial — `mendel-core` manual setup shown |
| Test docs stale                            | Medium   | Blocks contributors                        |
| Multilayer usage not shown                 | Low      | No example to follow                       |
