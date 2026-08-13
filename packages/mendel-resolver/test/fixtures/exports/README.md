# `exports`-field fixtures

Each package under `node_modules/` mirrors the `exports` structure of a real,
version-pinned npm package (structure only — no vendored code). Provenance:

| Fixture | Mirrors | Shape exercised |
| --- | --- | --- |
| `modernpkg` | [`@humanwhocodes/module-importer@1.0.1`](https://unpkg.com/@humanwhocodes/module-importer@1.0.1/package.json) `exports` map, with the legacy `main`/`module` fields removed to model main-less publishing (cf. exports-only [`p-map@7.0.5`](https://unpkg.com/p-map@7.0.5/package.json)) | exports-only package, `"."` with `require`/`import` conditions |
| `stringsugar` | [`strip-ansi@7.2.0`](https://unpkg.com/strip-ansi@7.2.0/package.json), [`string-length@6.0.0`](https://unpkg.com/string-length@6.0.0/package.json) | exports-only string sugar `"exports": "./index.js"` |
| `condsugar` | [`@humanwhocodes/retry@0.4.3`](https://unpkg.com/@humanwhocodes/retry@0.4.3/package.json) | top-level conditions sugar (no `"."`), nested `types`/`default`, legacy `main`/`module` agreeing with exports |
| `typesfirst` | [`ansi-escapes@7.3.0`](https://unpkg.com/ansi-escapes@7.3.0/package.json) | exports-only, `types` condition listed before `default` |
| `subpaths` | [`react-dom@18.3.1`](https://unpkg.com/react-dom@18.3.1/package.json) (subpath map, conditional `./server`, `./package.json`); `null` target per the [Node.js packages doc](https://nodejs.org/docs/latest-v22.x/api/packages.html#package-entry-points) — no null-blocking package ships in this repo's node_modules | subpath map, per-subpath conditions, `null` block, encapsulation |
| `patterns` | [`axios@1.16.0`](https://unpkg.com/axios@1.16.0/package.json) `"./unsafe/*": "./lib/*"` style | `*` subpath patterns |
| `catchall` | [`chai@4.5.0`](https://unpkg.com/chai@4.5.0/package.json) | extensionless legacy `main`, `"."` conditions plus `"./*": "./*"` catch-all |
| `nested` | [`axios@1.16.0`](https://unpkg.com/axios@1.16.0/package.json) | deep nested conditions, unknown conditions (`types`, `bun`, `react-native`) skipped in order, legacy `browser` object overlay coexisting with `exports` |
| `arraytarget` | [`@babel/runtime@7.29.7`](https://unpkg.com/@babel/runtime@7.29.7/package.json) | exports-only with no `"."` entry (bare require blocked), array targets `[conditions-object, string-fallback]` |
| `legacy-browser` | [`ws@8.21.0`](https://unpkg.com/ws@8.21.0/package.json), browser target deliberately divergent from the exports `browser` condition to pin mendel's browser-field overlay precedence | legacy `browser` string vs exports `browser` condition |
| `nanoid-like` | [`nanoid@3.3.18`](https://unpkg.com/nanoid@3.3.18/package.json) | legacy `main`/`module`/`browser`-object plus full exports map; the canonical dual package |
| `ordered` | hand-written per the Node.js resolution algorithm (`PACKAGE_TARGET_RESOLVE` iterates keys in object order; `default` matches unconditionally) | ordered condition matching |
| `stale-main` | hand-written; pins mendel's exports-over-main precedence when the legacy `main` points at a missing file | exports precedence, legacy fallback ordering |
| `@scope/pkg` | scoped-package layout as in [`@babel/runtime@7.29.7`](https://unpkg.com/@babel/runtime@7.29.7/package.json) | scoped package name parsing for subpath resolution |
