# Why Choose Mendel

## 1. Zero payload overhead — guaranteed

Every other A/B testing approach that uses conditionals (`if (experiment)`) ships dead code to users in the non-active branch. Mendel generates separate bundles per variation. A user assigned to `bucket_A` downloads only the files relevant to `bucket_A`. No byte is wasted on code paths that user will never execute.

This is not a configuration option. It is the architectural guarantee of building separate bundles per variation.

## 2. Experiments cost nothing at cleanup time

Deleting an experiment in Mendel means deleting a folder. There are no conditionals scattered across files, no search-and-replace across the codebase, no parser-based dead code elimination to run. The experiment folder is self-contained. Teams at Yahoo ran this pattern for years and measured a direct reduction in technical debt compared to conditional-based approaches.

## 3. Multilayer experiments without team coordination overhead

Most experimentation frameworks treat 100% of users as a single pool. When multiple teams want to run simultaneous experiments, they must negotiate how to divide that pool. Mendel supports layers: each layer independently divides 100% of users. A user assigned to `L1-B` and `L2-C` receives a single bundle that correctly merges both variations, computed on-demand at request time from a pre-built manifest.

Without this, teams are forced to serialize experiments or split user pools into fractions too small for statistical significance.

## 4. Variation inheritance for composable experiments

A variation can declare that it inherits from another variation. Only the delta — the files that differ from the parent — needs to exist in the child folder. A realistic hierarchy:

```
base (control)
  └── new_ad_format_main (new ad network + sidebar + vendor library)
        ├── new_ad_format_big (only views/ads.js changes)
        ├── new_ad_format_colorful (only views/ads.js changes)
        └── new_ad_format_discreet (only views/ads.js changes)
```

Three sub-experiments share the new ad network integration without duplicating any code. The `.mendelrc` declares the chain explicitly, so resolution order is always deterministic and consistent across all files.

## 5. Synchronous, zero-I/O production resolution

`mendel-core` loads all manifests into memory at process startup. Per-request variation resolution reads no files and makes no network calls. The hash for a given variation combination is computed by walking the in-memory manifest. This means variation resolution adds sub-millisecond latency to each request.

## 6. CDN-safe bundle URLs with built-in security

Bundle URLs use a content-addressed hash (the Mendel hash) instead of experiment names. The hash encodes: the Mendel protocol ID, a version byte, variation indexes, total file count, and a SHA1 of all file contents. This gives three properties simultaneously:

-   **CDN-safe**: the same hash is served to all users in the same variation combination; no `Vary` header needed.
-   **Cache-precise**: changing one file in one variation busts only the bundles that include that file.
-   **Opaque**: a browser user inspecting network requests cannot read experiment names from asset URLs.

## 7. Server-side rendering works correctly with experiments

`mendel-resolver` overrides Node's `require()` to resolve modules from the correct variation directory per request. This means isomorphic apps using React, Ember Fastboot, or any other SSR framework render the correct variation on the server and match it on the client. Most conditional-based A/B frameworks leave SSR as an afterthought or an unsupported edge case.

## 8. Any file type participates in variations

CSS, JSON, images, LESS — any file can differ between variations using the same folder structure. There is no special syntax or conditional wrapping needed. A variation can ship a different `theme.json`, a different `logo.png`, or a different `styles.css` just by placing those files in the variation folder.

## 9. Developer tools surface experiment code transparently

Because variation files live under mnemonic folder names (`new_ad_format`, `partner_C`), browser DevTools source maps show which file comes from which variation. A developer can:

-   Open the DevTools Sources panel and see `src/isomorphic/variations/bucket_A/views/ads.js` alongside `src/isomorphic/base/views/ads.js`.
-   Run `diff src/isomorphic/base/views/ads.js src/isomorphic/variations/bucket_A/views/ads.js` directly.
-   `grep` the base source tree to understand the non-experiment code path without seeing any experiment noise.

## 10. Battle-tested at scale

Mendel's core design ran inside Yahoo on teams of 3–30+ developers contributing daily to large production applications starting around 2014. The file-system variation strategy has been stable across that entire period. Mendel as a package is the formalization of that strategy, not a greenfield experiment.

## When NOT to choose Mendel

-   Your application has fewer than 2–3 simultaneous experiments and a small team. A simpler feature flag tool will have lower setup cost.
-   You need Webpack-specific features (module federation, HMR with Webpack's ecosystem). Mendel v2 targets Browserify and its transform ecosystem.
-   You need experiment assignment and analytics bundled into one tool. Mendel handles only the build/serve side.
