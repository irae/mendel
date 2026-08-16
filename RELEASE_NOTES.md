# Mendel release notes

Curated summaries of what each release means for users, newest first and
capped to the last few versions. The commit-by-commit ledger lives in
[CHANGELOG.md](CHANGELOG.md) and in each package's own `CHANGELOG.md`.

## 4.2.0 (2026-08-16)

### Breaking changes

All in undocumented APIs — hence a minor bump — but worth a read if you
script against the daemon client:

- **`client.isSynced()` is removed.** Pick the replacement that matches your
  intent:

    | Replacement                   | Returns                                          | Use it when                                                                                                                                                                                                                       |
    | ----------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `client.canServeRequest()`    | boolean                                          | Calling `client.build()` — true once bundle requests get an answer, including error bundles.                                                                                                                                      |
    | `client.getSyncState()`       | `'unsynced' \| 'synced' \| 'synced-with-errors'` | Detecting build errors to hold, retry, or report. Build errors now settle at `'synced-with-errors'` (inspect via `client.client.getErrors()`) instead of hanging in `'unsynced'` or crashing the daemon.                          |
    | `client.isRegistryComplete()` | boolean                                          | Reading the registry directly (`registry.getEntry()`, `registry.walk()`) — true only when every entry is present and error-free. An errored entry is dropped, and its normalizedId could otherwise resolve to a variation's file. |

- **Deep requires respect `exports`.** `require('pkg/lib/x')` now hard-fails
  when the package's `exports` map has no matching entry, exactly like
  Node.js. First suspect when a build breaks after a dependency bump.
- **An empty bundle is a build error**, not a silently empty file. Negative-
  only globs, missing files, and typos all fail loudly.

### The daemon survives your errors

A build error used to hang clients or take the daemon (and its siblings)
down. The daemon now stays up and answers every bundle request with a
rendered error page — one underlying error, reported once, with a real code
frame. Deleted files re-sync cleanly instead of stalling the build pass, a
file's own parse failure surfaces as that entry's error, and missing
plugins, parsers, and generators fail fast with actionable messages.

### Resolution matches modern npm packages

The resolver understands conditional `exports` / `imports` maps (including
the `umd` condition d3-style ESM-only packages need), scopes browser-field
mappings and `false` exclusions to the package that declares them, keys its
cache by directory so nested duplicate installs can't poison resolution,
and rejects `..` / `node_modules` escapes the way Node does. Editing a
package.json's `exports` in watch mode now applies without a daemon
restart.

### Browser test runs (karma-mendel) actually finish

The karma page now gets the same `global` and full `process` shims as a real
bundle, test runs no longer execute against an errored build, and a build
error in watch mode recovers instead of killing the karma process. Suites
that previously aborted mid-run complete; environments created on demand
(karma's test client against a dev daemon) share package identity with the
dev environment instead of serving node-only builds to the browser.

### Devtools open your original source

Development bundles now interleave each transformed module with its own
inline sourcemap and script identity (`mendel://<project>/<path>`). Stack
frames, Chrome Sources, and React DevTools' view-component-source land in
the original file instead of a multi-megabyte pack. Settled by design:
sourcemaps are never served at a separate URL — a dev bundle and its map
must load in sync.

### New package: mendel-parser-plaintext

Parses any watched file into a JS module exporting its contents as a
string.

### Modernized foundations

Node 22, tap 21, ESLint 10, lerna 10, and friends; abandoned dependencies
replaced with maintained ones (css → postcss, request → native fetch,
mkdirp → native fs, and more); browserify-era legacy tests and
mendel-requirify retired from the active workspace.
