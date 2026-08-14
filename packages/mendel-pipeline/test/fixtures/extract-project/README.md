# `extract-project`

Base tree plus a `test_A` variation, sized for `mendel-generator-extract`:
`main` holds the entry and its direct requires, `lazy` is extracted out of it.

`variations/test_A/third-number.js` has no base counterpart. The lazy bundle
reaches it through `number-list.js`, so a build that cannot resolve a file
existing only in a variation fails here.

Consumed by `generator-extract.js`. The v1-format `numbers-app` under
`packages/mendel-core/test/app-samples/1/` shares several filenames with this
tree but is a different project: it declares variations as sibling directories
of `app/` in the pre-2.0 `.mendelrc` format and is not interchangeable.
