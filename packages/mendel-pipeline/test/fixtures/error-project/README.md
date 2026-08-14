# `error-project`

The smallest app that can be broken and repaired on demand:
`app/main.js` requires `app/helper.js`, and `throwing-transform.js` fails on any
source containing `MENDEL_BREAK_ME`, so a test can break exactly one module by
appending a comment. The thrown message carries a `*/` so a test can assert that
error text cannot terminate a CSS comment early.

`app/uses-notes.js` requires `app/notes.md`, an extension with no parser, to
make a bundle generator throw rather than a transform.

`variations/exp/helper.js` overrides `app/helper.js` with recognisably
different output, so a test that breaks the base file can tell whether a
consumer silently fell back to the variation's code. Tests that do not declare
`variation-dirs` never see it.

Consumed by `packages/mendel-pipeline/test/error-handling.js`,
`packages/mendel-development-middleware/test/middleware.js` and
`packages/karma-mendel/test/errored-build.js`. All mutate their sources, so all
stage it with `copy: true` into their own package's run directory — the
mutation must never reach this tree.
