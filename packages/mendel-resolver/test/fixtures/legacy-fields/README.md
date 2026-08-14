# `legacy-fields`

Stub packages for the pre-`exports` resolution fields — `main`, `module`,
`browser` (string and object forms) and the UMD/CDN hints — exercised by
`../../legacy-fields.js` and `../../cwd-independence.js`.

Structure only, no vendored code. Each package isolates one way the legacy
fields disagree with each other or point somewhere that does not exist, because
the resolver's job here is to pick a real file without trusting the manifest.

| Package              | Shape exercised                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser-object`     | the object form of `browser` doing all three of its jobs at once: remapping a relative file, remapping a bare package name to another package, and blanking a file with `false` |
| `component-emitter`  | the package a bare-name `browser` remap points at                                                                                                                               |
| `emitter`            | the package that remap replaces, so both ends of the mapping exist                                                                                                              |
| `broken-browser-map` | a `browser` remap whose target file is missing; the map must not win over a resolvable `main`                                                                                   |
| `stale-main-partial` | `main` pointing at a file that no longer exists while `module` is real — the common shape after a package drops its CJS build                                                   |
| `umd-pkg`            | a `umd` condition in `exports` alongside a resolvable `main`/`module`                                                                                                           |
| `umd-ignored`        | the same shape where taking `umd` would be wrong, pinning that the UMD build is not a general-purpose entry                                                                     |
| `unpkg-pkg`          | the `unpkg` CDN field, which is not a resolution field at all and must be ignored                                                                                               |
