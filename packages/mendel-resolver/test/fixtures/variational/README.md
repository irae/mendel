# `variational`

One project mixing the three variation shapes a real Mendel app combines, so
that resolution is exercised against a tree rather than against three trees each
proving one point. All `.js` files are empty where only their existence matters.

| Module                     | Shape                                                          | Why it resolves that way                                                                                                               |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `footer/`                  | the variation ships its own `package.json`                     | every runtime resolves inside the variation, except `main`, which the variation's `package.json` points back at a file it does not own |
| `sidebar/`                 | the variation overrides one file and ships no `package.json`   | `main` and `browser` fall back through the base `package.json`; only `extra` lands in the variation                                    |
| `variation-only-module.js` | the module exists in the variation and has no base counterpart | resolution must reach it from a variation basedir instead of failing                                                                   |

`footer` and `sidebar` are two module names rather than two fixtures because
their shapes are mutually exclusive at one path: a directory either has a
variation-side `package.json` or it does not.

Expectations are per case in `expect/<case>.json`, driven by the case table in
`../../all.js`.
