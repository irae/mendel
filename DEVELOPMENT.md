# Mendel Development

Mendel uses `pnpm` for workspaces and speed, `lerna` for multi-package
version/publish, and `husky` + `commitlint` for conventional commits.

## Dependencies

```bash
pnpm install
```

Reset package `node_modules` if the workspace graph looks wrong:

```bash
pnpm lerna clean
pnpm install
```

Use the same Node major as your consumer app when linking (this monorepo
targets Node ≥ 20; `v22.13.1` via nvm is fine).

## Linking a consumer project

Goal: an application that depends on Mendel runs this checkout instead of
the published `4.x` tarballs, without publishing.

**What works: replace each installed `mendel-*` / `karma-mendel` directory
with a plain symlink to `packages/<name>` in this monorepo.** Do not use
`pnpm link` / `pnpm link --global` for this. pnpm 10 often fails with
`Symlink path is the same as the target path (.../pnpm/global/.../pkg)`
once any package is already partially linked, and a consumer whose
`node_modules` is flattened (npm-style, or a copied tree) has no `.pnpm`
virtual store for `pnpm link` to rewrite.

The Mendel checkout still uses pnpm for _its own_ workspace. The consumer
can be npm or pnpm. Use the **same Node major** on both sides.

### One step (consumer)

App already has Mendel installed (`pnpm install` / `npm install` once):

```bash
cd /path/to/your-app
bash /path/to/mendel/scripts/link-into-project.sh
```

The script finds every `mendel-*` / `karma-mendel` under the app’s
`node_modules`. Real directories are moved to
`node_modules/.mendel-linked-backup/` the first time; then each name is
replaced with a symlink:

```text
node_modules/mendel-deps -> /path/to/mendel/packages/mendel-deps
```

Runtime `require()` follows that symlink into this checkout. Internal
workspace deps (`mendel-pipeline/node_modules/mendel-config` →
`../../mendel-config`, `browser-pack` at the monorepo root) resolve from
**this** Mendel tree. A second git worktree is an empty checkout: run
`pnpm install` there (or copy both the repo-root `node_modules` and each
`packages/*/node_modules`). Root-only `node_modules` is not enough —
`mendel-config` is not hoisted.

Optional monorepo override (a second worktree, for example):

```bash
bash /path/to/mendel/scripts/link-into-project.sh /other/path/to/mendel
# or
MENDEL_ROOT=/other/path/to/mendel bash /path/to/mendel/scripts/link-into-project.sh
```

Manual single package:

```bash
cd /path/to/your-app
mkdir -p node_modules/.mendel-linked-backup
# first time only: mv node_modules/mendel-deps node_modules/.mendel-linked-backup/
ln -s /path/to/mendel/packages/mendel-deps node_modules/mendel-deps
```

If the consumer’s `node_modules` is itself a symlink to another checkout,
replace that symlink with a real directory first (copy or clone the tree).
Otherwise the script would retarget the _shared_ install.

### Optional: register global links (Mendel side only)

Only needed if you still want packages in the global pnpm store for other
tools. Not required for the consumer flow above.

```bash
cd /path/to/mendel
pnpm run link:global
```

### Verify

In the consumer:

```bash
ls -la node_modules/mendel-deps
ls -la node_modules/mendel-pipeline
# expect: …/mendel/packages/mendel-deps  (or …/mendel-<worktree>/packages/…)
# not a store hash and not node_modules/.mendel-linked-backup/…
```

These should resolve into this clone:

- `mendel-deps` (parses `.cjs`)
- `mendel-resolver` (probes `.cjs` / `.mjs`)
- `mendel-pipeline` (deps worker extensions)

### Unlink (go back to registry versions)

If `.mendel-linked-backup/` still has the originals:

```bash
cd /path/to/your-app
# for each name in node_modules/.mendel-linked-backup:
#   rm node_modules/<name>
#   mv node_modules/.mendel-linked-backup/<name> node_modules/<name>
```

Or reinstall from the lockfile (`pnpm install` / `npm install`), which
drops the symlinks. Then remove an empty `.mendel-linked-backup/`.

### If a previous global `pnpm link` left things half-broken

```bash
cd /path/to/your-app
pnpm install   # or npm install
bash /path/to/mendel/scripts/link-into-project.sh
```

## Versioning

https://github.com/lerna/lerna/tree/main/libs/commands/version

Prerelease / beta:

```bash
pnpm lerna version prerelease
```

Real releases (conventional commits):

```bash
pnpm lerna version --conventional-commits --no-push   # review first
pnpm lerna version --conventional-commits
```

## Release notes (`RELEASE_NOTES.md`)

Two documents, two jobs:

- **`CHANGELOG.md`** (root and per-package) is lerna-generated from
  conventional commits and is the commit-by-commit ledger. Never hand-edit
  it; `lerna version --conventional-commits` owns it.
- **`RELEASE_NOTES.md`** (repo root) is the curated summary: changes grouped
  by user-meaningful outcome (a few thematic paragraphs, breaking changes
  with migration guidance), pointing at the changelogs for full detail.
  It never lists one item per commit — that is the changelog's job.

Process, every release:

1. The agent preparing the release writes the new version's section **before**
   running `lerna version` — the tag must contain it.
2. **Rolling window**: keep at most the last 3 versions in the file. When
   adding a new section, strip the oldest so the file stays small. Older
   notes live on in git history and in the changelogs.
3. The notes ship inside every npm package: each package's `prepack`
   (`scripts/prepack.js`) enforces pnpm and copies the root
   `RELEASE_NOTES.md` into the package, and every `files` whitelist includes
   it. The per-package copies are gitignored — only the root file is
   tracked.

## Workspace dependencies (`workspace:^`)

Internal packages and examples use:

```json
"mendel-config": "workspace:^"
```

pnpm links the monorepo copy at install, and rewrites to `^x.y.z` on pack/publish.

**Do not pack or publish with `npm`.** npm leaves `workspace:^` in the tarball;
the registry often accepts it, but consumers cannot install. Every public package
has a one-line `prepack` that throws unless the tool is pnpm.

## Publishing

Use **pnpm only** (`lerna.json` already has `"npmClient": "pnpm"`).

### 1. Dry-run the tarball

```bash
cd packages/mendel-pipeline
pnpm pack
tar -xOf mendel-pipeline-*.tgz package/package.json | grep mendel-
# expect: "mendel-config": "^4.1.1"  — never workspace:
rm mendel-pipeline-*.tgz
```

In the file list, confirm:

- **no** `test/`, `tests/`, or fixture trees
- **no** `.nyc_output/`, `coverage/`
- **yes** `docs/` when the package has docs (agents read these from
  `node_modules` offline)
- **yes** runtime sources (`src/`, `*.js`, `lib/`, …)

### 2. Publish

```bash
pnpm lerna publish from-package --otp 123456
```

Replace `123456` with your 2FA code.

### What gets packed (`files` whitelist)

Every `packages/*` package declares a `"files"` array in `package.json`. That
whitelist is the source of truth for the npm tarball: documentation is included;
tests and coverage are not. Prefer extending `"files"` over adding a package-local
`.npmignore`.

Why not rely on root `.gitignore` alone:

- npm pack for a workspace package does **not** use the monorepo root
  `.gitignore` unless the package has no `"files"` and no `.npmignore` of its
  own — and even then only ignore files inside that package directory apply.
- If a package has a **`.npmignore`**, npm **ignores `.gitignore` entirely** for
  that package. A tiny `.npmignore` (e.g. only `test`) will happily ship
  `.nyc_output/`. Do not add per-package `.npmignore` unless it is complete.
