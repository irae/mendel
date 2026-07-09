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

**Preferred path (pnpm 9/10): link package directories directly.** Do not use
`pnpm link --global <name>` into the consumer — pnpm 10 often fails with
`Symlink path is the same as the target path (.../pnpm/global/.../pkg)` once
any Mendel package is already partially linked.

Both sides should use **pnpm** and the **same Node**.

### One step (consumer)

App already has Mendel installed (`pnpm install` once):

```bash
cd /path/to/your-app
bash /path/to/mendel/scripts/link-into-project.sh
```

The script lives in this monorepo; it finds every `mendel-*` / `karma-mendel`
under the app’s `node_modules` and runs:

```bash
pnpm link /path/to/mendel/packages/<name>
```

Optional monorepo override:

```bash
bash /path/to/mendel/scripts/link-into-project.sh /other/path/to/mendel
# or
MENDEL_ROOT=/other/path/to/mendel bash /path/to/mendel/scripts/link-into-project.sh
```

Manual single package:

```bash
cd /path/to/your-app
pnpm link /path/to/mendel/packages/mendel-deps
pnpm link /path/to/mendel/packages/mendel-resolver
pnpm link /path/to/mendel/packages/mendel-pipeline
```

Internal monorepo deps are workspace symlinks
(`mendel-pipeline/node_modules/mendel-deps` → `../../mendel-deps`). Linking
the packages your app lists is enough for local `mendel-deps` / resolver
(including the dual-package `.cjs` fix) to load.

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
# expect: …/mendel/packages/mendel-deps (not only a store hash)
pnpm why mendel-deps
```

For the dual-package / `react-use-measure` work, these should resolve into
this clone:

-   `mendel-deps` (parses `.cjs`)
-   `mendel-resolver` (probes `.cjs` / `.mjs`)
-   `mendel-pipeline` (deps worker extensions)

### Unlink (go back to registry versions)

```bash
cd /path/to/your-app
pnpm install   # reinstalls from lockfile; drops local links
```

### If a previous global link left things half-broken

```bash
cd /path/to/your-app
pnpm install
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

## Publishing

### 1. Dry-run the tarball (do this first — easy to forget)

Packing is per package. Always inspect what will ship before `lerna publish`:

```bash
# Worst historical offenders; run any package you changed
cd packages/mendel-pipeline && npm pack --dry-run
cd ../mendel-resolver && npm pack --dry-run
cd ../mendel-deps && npm pack --dry-run
```

Or from the monorepo root:

```bash
npm pack --dry-run -w mendel-pipeline
npm pack --dry-run -w mendel-resolver
```

In the notice list, confirm:

-   **no** `test/`, `tests/`, or fixture trees
-   **no** `.nyc_output/`, `coverage/`
-   **yes** `docs/` when the package has docs (agents read these from
    `node_modules` offline)
-   **yes** runtime sources (`src/`, `*.js`, `lib/`, …)

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

-   npm pack for a workspace package does **not** use the monorepo root
    `.gitignore` unless the package has no `"files"` and no `.npmignore` of its
    own — and even then only ignore files inside that package directory apply.
-   If a package has a **`.npmignore`**, npm **ignores `.gitignore` entirely** for
    that package. A tiny `.npmignore` (e.g. only `test`) will happily ship
    `.nyc_output/`. Do not add per-package `.npmignore` unless it is complete.
