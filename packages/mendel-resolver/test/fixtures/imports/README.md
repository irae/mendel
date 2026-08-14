# `imports`-field fixtures

`#`-prefixed specifiers are private to the package that owns the *requesting*
file, so every fixture here is exercised with `basedir` pointing inside the
package whose `imports` map is under test. The fixture root itself carries an
`imports` map to cover application-level (non-`node_modules`) scopes.

Packages under `node_modules/` mirror the `imports` structure of real,
version-pinned npm packages (structure only — no vendored code). Provenance:

| Fixture | Mirrors | Shape exercised |
| --- | --- | --- |
| root `package.json` | hand-written, app-level scope | `*` pattern, per-runtime conditions, `null` block, and targets Node rejects as invalid: `#` self/mutual references and a `../` escape out of the package |
| `chalk-like` | [`chalk@5.6.2`](https://unpkg.com/chalk@5.6.2/package.json) | string target, `node`/`default` conditions splitting node from browser |
| `enums-like` | [`@typescript/native-preview@7.0.0-dev`](https://unpkg.com/@typescript/native-preview/package.json) `"#enums/*"` | `*` pattern with an unmatched `types` condition listed first |
| `bare-target` | hand-written per the [Node.js packages doc](https://nodejs.org/docs/latest-v22.x/api/packages.html#subpath-imports) | targets that are bare package names, re-entering `node_modules` resolution |
| `both-forms` | hand-written; browser-map target deliberately divergent from the `imports` `browser` condition | precedence of `imports` over mendel's legacy `browser` overlay for `#` literals |
| `dep-pkg` | plain package | resolution target of `bare-target` |

`../imports-variational/` pins the package scope of a file living in a
variation directory: the nearest enclosing `package.json` is the project root,
and its `imports` targets are package-relative, so they are not remapped
through the variation chain.
