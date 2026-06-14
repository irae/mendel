# Documentation Gaps

These are missing or incomplete documentation areas, ordered by impact on a new user's ability to adopt Mendel.

## Critical gaps

### Getting started guide (does not exist)

There is no document that takes a developer from zero to a working Mendel project. The README points to the examples directory, but examples assume you already have context about Mendel's model. What is missing:

-   Minimum required packages to install
-   Minimum `.mendelrc` to build a single base bundle
-   How to add a first variation
-   How to run the development workflow
-   How to build for production

This is the highest-impact missing document. Every new adopter needs it and it does not exist in any form.

### Configuration reference (stub only)

`docs/Configuration.md` exists but contains zero content — only section headings. It is linked from the main README as a resource for understanding configuration. The closest substitute is the annotated `.mendelrc` in `packages/mendel-config/README.md` and the full-example's `.mendelrc`. Neither is referenced from the main README.

Missing from any document:

-   Complete list of all valid `.mendelrc` keys with types and defaults
-   Explanation of path resolution rules (`basedir`, relative paths, `bundlesoutdir` relative to `outdir`)
-   The rule that `base` is always implicitly appended to variation chains
-   The constraint that variation folder names must be unique across all `variation-dirs`
-   How `MENDEL_ENV` and `NODE_ENV` interact

### Installation and integration guide (does not exist)

There is no document covering how to add Mendel to an existing application. The packages needed for a minimal setup are distributed across the monorepo, but no document names them or explains which are required versus optional. A developer must read through the full-example's `package.json` and reverse-engineer what is needed.

## Significant gaps

### Outlet/environment switching for production (not documented outside examples)

The requirement to change every bundle's `outlet` value to `manifest` in the `env.production` block is only visible by reading the full example's `.mendelrc`. There is no prose documentation explaining why this is required, what happens if you omit it, or whether there are edge cases (e.g., CSS bundles also need the switch, with additional `serveAs` metadata).

### Development workflow (scattered)

The two-process development requirement (daemon + application server) is visible in the examples README, but not explained. Missing:

-   Why the daemon is separate
-   What the daemon does that the application server cannot do alone
-   What errors you get if only one process is running
-   How to configure the IPC socket path (`MENDEL_IPC`) between the two processes (only visible in the full example's npm scripts)

### Variation override in development (not documented)

Design.md states that variations can be overridden via query string, developer box configuration, and cookies. None of these mechanisms are documented anywhere in the user-facing docs. The full example's server code presumably implements this, but there is no reference to how `mendel-middleware` exposes it.

### Testing variations (not documented for users)

The full example has test scripts that use `mendel-mocha` and `karma-mendel`, but no document explains how to write tests that run against specific variations. The design document mentions testing variations as a maintainability benefit, but does not explain how to achieve it. `mendel-mocha-runner` has no README at all.

### mendel-middleware API (not documented)

`mendel-core/README.md` provides a clear API reference with working code examples. `mendel-middleware` is the production-ready wrapper that most applications will use, but its README does not exist as a standalone document. Its API — how to mount it in Express, what routes it creates, what options it accepts — must be inferred from the source code.

### Testing variations (not documented for users)

The full example has test scripts using `mendel-mocha` and `karma-mendel`, but there is no document explaining how to write tests that run against specific variations. The design document mentions testing variations as a maintainability benefit, but does not explain how to do it.

## Secondary gaps

### Roadmap is stale (v2 goals, project is at v4)

`docs/Roadmap.md` reflects 2017-era goals for Mendel 2.0. Multi-core support and rollup integration are listed as aspirational. Both are now implemented. The roadmap contains no information about v3 or v4 changes. A reader cannot use it to understand the project's current state or future direction.

### Design.md stale sections are not demarcated

Two sections in `docs/Design.md` are self-marked as outdated but have not been removed. A new reader cannot tell which parts of the document describe the current architecture and which describe abandoned approaches. The "Client-side Design" section is particularly risky because it describes an earlier, non-manifest-based approach to bundling that no longer matches how Mendel works.

### Package-level documentation is thin or absent

Several packages that users interact with directly have unusable documentation:

| Package                            | Current state             | What is needed                                              |
| ---------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `mendel-transform-babel`           | "API: WIP"                | Options mapping, how to pass Babel config                   |
| `mendel-transform-buble`           | Two sentences             | Options, deprecation status vs babel                        |
| `karma-mendel`                     | "fork with modifications" | What the modifications are, how to configure                |
| `mendel-development-middleware`    | One sentence              | Mount point, options, relationship to daemon                |
| `mendel-outlet-server-side-render` | No README exists          | SSR setup, `requireTransform`, `includeNodeModules` options |
| `mendel-mocha-runner`              | No README exists          | How to use `mendel-mocha` CLI                               |

### ManifestValidation SHA error is not discoverable

`docs/ManifestValidation.md` is a well-written troubleshooting document for the SHA mismatch error. It is not linked from the main README, `Configuration.md`, or any package README. A developer searching the repository for the error message text finds the source code that emits it, not the documentation explaining it. The document needs a link from the main README's troubleshooting section — which does not yet exist. Finding this document currently requires knowing it exists.

### `normalizedId` conflicts have no user-facing documentation

The concept of `normalizedId` and why it causes conflicts in multivariate scenarios is documented in the pipeline architecture README (`packages/mendel-pipeline/docs/DEVELOPMENT-README.md`), which is an internal developer document. There is no user-facing explanation of:

-   What a normalizedId is
-   What a "conflict" means in practice
-   How to structure variation folders to avoid conflicts
-   How to interpret the conflict error message
