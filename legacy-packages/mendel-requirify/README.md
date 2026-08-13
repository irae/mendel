# mendel-requirify

This package is historical/prototype code, kept here for reference only.

It is a browserify plugin that demonstrates the approach Mendel used early on
to write out individual "requirified" dependency files from the browserify
pipeline. It is not maintained, not published, and not part of the pnpm
workspace — nothing else in this repo depends on it.

Its role has been superseded by `mendel-outlet-browser-pack`.

## Tests here are unattended

`test/` also holds the browserify-era root integration tests that used to live in
the repo's `test/` directory (`mendel-requirify.js`, `mendel-loader.js`). They were
moved here so the main repo's legacy suite stops depending on retired code.

None of it runs, and none of it is expected to. There is no `node_modules` here,
no `test` script, and `mendel-loader.js` still requires `mendel-browserify`, a
package that no longer exists. Relative paths were rewritten on the move so the
sources stay readable, not because they resolve.

Treat all of this as dead code kept for reference. Do not wire it into CI.
