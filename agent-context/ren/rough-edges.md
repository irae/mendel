# Rough Edges and Pain Points

These are the specific friction points a new user will hit, sourced from reading the documentation, configuration, and examples.

## 1. Two-process development workflow is not documented upfront

The `full-example` `package.json` shows two required commands to develop:

```
npm run daemon       # starts mendel-pipeline watcher
npm run development  # starts the Node server
```

Neither the README nor any top-level doc explains that Mendel v2 requires two simultaneous processes. A user who only runs the server gets no bundles. The daemon/client architecture is explained deep in `packages/mendel-pipeline/docs/DEVELOPMENT-README.md`, not in any getting-started guide.

## 2. Configuration.md has zero content

`docs/Configuration.md` has six section headers:

-   Path configuration
-   Variations and Variation Inheritance
-   Bundle configuration
-   Middleware configuration
-   Environment based overrides
-   Post process middleware plugin configuration

Every section is empty. A user searching for how to configure `.mendelrc` finds only headers. The only real configuration reference is embedded in `packages/mendel-config/README.md` (API), the `full-example/.mendelrc` (heavily commented), and scattered across design documents.

## 3. Stale contributor instructions in README.md

The main `README.md` instructs contributors to run:

```bash
npm run bootstrap
```

But `DEVELOPMENT.md` specifies the actual workflow:

```bash
pnpm install
pnpm lerna exec "pnpm link --global"
```

The project migrated from npm scripts + manual linking to pnpm + lerna. The README was not updated. A new contributor following README instructions will fail to set up a dev environment.

Similarly, `docs/Tests.md` says `npm run linkall`, which does not exist in the current pnpm-based workflow.

## 4. Integration tests require private repository access

`docs/Tests.md` states:

> "Mendel relies on some private repositories for integration tests. Make sure you have the appropriate access in order to run integration tests."

External contributors cannot run the full test suite. No workaround or alternative is documented.

## 5. Design.md has explicitly marked stale sections

Three notes in `docs/Design.md` flag outdated content:

1. Client-side Design section: "Important note: This section is outdated."
2. Variation Inheritance section: "Note: This section needs reviewing. This is now covered by .mendelrc file…"
3. Comparison section: "Note: This was a bullet list compiled from a series of Q&A sessions internally held at Yahoo. This section is here for historical purposes and will be removed…"

A new reader has no way to know which parts of the design document reflect the current implementation.

## 6. Manifest validation error appears before the user understands config

`docs/ManifestValidation.md` documents the error:

```
Error: Files with same variation (base) and id (body.js) should have the same SHA
```

This error fires when a variation file uses a different path resolution than the base file (e.g., `square.js` vs `square/index.js`). A new user hitting this will not know to read ManifestValidation.md because no getting-started guide mentions it. The error message references SHA, and the explanation requires understanding how Mendel normalizes module IDs — a concept documented only in the pipeline developer docs.

## 7. The "normalizedId" constraint is buried

`packages/mendel-pipeline/docs/DEVELOPMENT-README.md` explains that if a variation and base resolve `require('./foo/bar')` to different file paths (`foo/bar.js` vs `foo/bar/index.js`), Mendel flags a conflict. This constraint directly affects day-to-day development: a developer who adds an `index.js` inside a directory previously resolved as a single file will break all bundles referencing it. This rule is documented only in the internal developer doc, not in any user-facing guide.

## 8. Variation inheritance syntax changed and the old syntax is still shown

`docs/Design.md` shows the original design syntax for variation inheritance:

```json
{
    "new_ad_format_discreet": {
        "folders": ["new_add_format_discreet", "new_ad_format_main", "default"]
    }
}
```

And the current `.mendelrc` syntax:

```yaml
variations:
    new_ad_format_discreet:
        - new_add_format_discreet
        - new_ad_format_main
```

Both syntaxes appear side-by-side with a note saying "this section needs reviewing." No document clearly states which syntax is current and which is historical.

## 9. Production deployment flow has no step-by-step guide

Deploying Mendel to production requires:

1. Running `NODE_ENV=production mendel` to build manifests.
2. Switching all outlets in `.mendelrc` `env.production` to `mendel-outlet-manifest`.
3. Starting `mendel-middleware` in the Node server to serve hashed bundles.
4. Pointing the CDN at the middleware route.

Step 2 is easy to miss. The full-example `.mendelrc` has a comment for it: `"In Mendel 3.0 it is still required to switch all outlets in production to use the manifest outlet"`. This should be a documented production checklist, not a comment in an example file.

## 10. Package READMEs range from minimal to empty

Several packages that users interact with directly have near-empty documentation:

| Package                          | README content                              |
| -------------------------------- | ------------------------------------------- |
| `mendel-transform-babel`         | "API: WIP"                                  |
| `mendel-development-middleware`  | One sentence                                |
| `mendel-pipeline/docs/README.md` | "Lesson from V1" (no body)                  |
| `karma-mendel`                   | "Fork of karma-commonjs with modifications" |

The transform and middleware packages are part of a new user's first setup. Finding that their documentation is empty forces the user to read the example `.mendelrc` or source code to understand configuration options.

## 11. MENDEL_ENV vs NODE_ENV interaction is undocumented

`mendel-config/README.md` mentions that `process.env.MENDEL_ENV` or `process.env.NODE_ENV` triggers environment-specific config. The `full-example` test scripts use `MENDEL_IPC=.mendelipc-test MENDEL_ENV=test`. No document explains what happens when both are set, which takes precedence, or what the recommended practice is for CI environments.
