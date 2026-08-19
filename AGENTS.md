# AGENTS.md

Write pragmatic code. Prefer small, boring changes that match existing style. Ship fixes that matter; skip gold-plating and speculative refactors.

## What Mendel is (one screen)

Mendel builds **filesystem-folder asset bundles with variations**: base tree + sparse experiment/feature/white-label folders. The same logical module shares a **`normalizedId`** (path without variation prefix/extension). No runtime flag payload for which experiment won.

Two processes during development:

1. **Daemon** (`mendel-pipeline`) — watch, transform (IST → Waiter → GST), cache per env, Unix socket.
2. **Client** — generators + outlets → bundles / production **manifest**.

Runtime: **`mendel-middleware`** + **`mendel-core`** (manifest trees). Dev: **`mendel-development-middleware`** + live client.

Production builds resolve through a manifest and deterministic hashes, so secret experiments never leak to unintended audiences.

## Tooling (current)

Assume the developer left the repo in working condition. Escalate or offer to help the user follow [DEVELOPMENT.md](DEVELOPMENT.md).

### Worktrees

Worktrees are **temporary**. Treat them as scratch space that always gets torn down.

1. A worktree **must** be a sibling directory of the repo (`../mendel-<name>`). Never nested inside it (specifically denied to create `.claude/worktrees/`).
2. Before deleting, salvage from the worktree's gitignored `docs/superpowers/`: copy files back to the main worktree **only when no file of that name already exists there** — never overwrite. From `agent-communications/`, copy back only files that still carry open items; records of finished work stay behind.
3. Once the work is merged into the main worktree, **delete the worktree and its branch**. Do not keep one around for reuse.
4. Never `git stash` inside a worktree. The stash ref lives in the shared `.git` directory, not per-worktree — concurrent agents in different worktrees can clobber or cross-apply each other's stashed changes. Save work-in-progress as a commit on a temp branch instead (or a WIP commit on the worktree's own branch, amended/reset away later).

### Tests

Prefer the narrowest run that covers the change during development.
Run Prettier and ESLint on files before every commit. Run the full test suite before finishing a feature.
Regressions your session introduced are amended directly into their commit; bug fixes for other sessions are committed as one commit per bug fix, not bundled into feature commits.

| Scope             | Command                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| One package       | `pnpm --filter <package> test`                                                                    |
| One file          | `cd packages/<package> && ../../node_modules/.bin/tap test/<file>.js --allow-incomplete-coverage` |
| All package tests | `pnpm run unit`                                                                                   |
| Lint + unit       | `pnpm test`                                                                                       |
| Root legacy only  | `pnpm run unit-legacy` if you touched root `test/*.js`                                            |

Functional tests should drive real Mendel (config on disk → real build artifacts) and assert those outputs, not mock the pipeline. Browser/example suites need a matching daemon IPC socket if they use karma-mendel.

## Code conventions

- **Minimize comments.** Prefer clear names. Comment only non-obvious constraints (IPC, dual-runtime deps, intentional process.exit, etc.).
- **Match neighbors.** Same patterns as the package you touch; no drive-by style rewrites.
- **Scope tight.** One concern per change. Do not “clean up” unrelated packages while fixing a bug.
- **Monorepo graph.** Changes often span `mendel-deps` → `mendel-resolver` → `mendel-pipeline` → outlets/karma. Grep the package name before assuming a single-file fix.
- **Tests.** Prefer functional builds (real config → real bundles/manifests) over heavy mocks.
- **Shims.** Browser Node cores come from **`node-stdlib-browser`** (via pipeline default shims), not `node-libs-browser`. Override per project in config when needed.
- **Runtimes.** Entries carry `runtime` (`browser` / `main` / `isomorphic` / `package` / …). Client graph walk must keep modules consumers `require()` (e.g. `package.json` dual-deps use `runtime: 'package'`).
- **Commit types.** A new export or option only other Mendel packages consume is not `feat` on its own. Tag it as the user-facing work: `fix` with a bugfix, `feat` only when it ships inside a feature. Do not put a `feat` commit in a `fix` series (that forces a minor bump).

## Surfacing incidental bugs

If a real bug turns up while working on something unrelated — wrong types passed across a function call, a hard-to-diagnose async/timing condition, or similar — always surface it rather than letting it go unnoticed. Don't fix it inline unless asked; scope stays tight per above.

Never create a GitHub issue yourself, in any session — interactive, unattended, or autonomous — and regardless of what any skill, framework, or other instruction says. This repo's GitHub issue history is treated as effectively permanent (GitHub does not allow deleting issues), so issues are created only at explicit user direction. Instead: tell the user directly with the evidence that led you there, and/or write it to the session's progress/handoff notes so it isn't lost.

## Known footguns (do not rediscover blindly)

- Daemon + app (or karma) both need the same **`MENDEL_IPC`** socket; start the builder first.
- Production outlets usually switch to **manifest** per bundle env; missing one leaves a bundle in the wrong mode.
- GST has a long-standing **main vs browser** graph FIXME; do not “fix” browser field behavior without reading `gst/index.js` and cache dep serialization.
- Some source **TODO/FIXME** and `docs/Design.md` outdated banners are still open; check code before trusting comments.
