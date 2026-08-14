# `node-modules-project`

One app whose dependencies each carry a `package.json` shape that used to break
the outlet graph. `stubs/` is staged as `node_modules/` by `stageFixture` —
a directory literally named `node_modules` cannot be committed.

| Stub            | Mirrors                                                                   | Shape exercised                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fake-dual`     | a dual-package build with `main` pointing at `.cjs` and `module` at `.js` | browser/main runtimes must take the CJS entry and still record its `require()`s                                                                   |
| `helper-lib`    | a plain CJS dependency                                                    | resolution target of `fake-dual`'s CJS entry                                                                                                      |
| `fake-pkg-json` | `elliptic` and the crypto-browserify chain under karma-mendel             | a JS entry that `require('../package.json')`, so the package emits a JS node and a `runtime: 'package'` node that the client graph walk must keep |

Entries are per test: `app/dual-package.js` for `dual-package-cjs.js`,
`app/package-json-require.js` for `package-json-require.js`. Both build a
vendor bundle through `mendel-generator-node-modules` and assert by searching
the manifest indexes, so the extra stubs are inert for each other.
