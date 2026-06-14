# Mendel vs. the Ecosystem

## The Ecosystem's Consensus

Every major JavaScript bundler — webpack, Vite, Rollup, Rolldown, Rspack, esbuild, Parcel, Turbopack, Farm, Mako, Bun's bundler, Metro — optimizes for building one version of an application. A/B testing sits outside their scope. The ecosystem's answer to experimentation is one of four runtime approaches, each carrying a tax:

1. **Runtime conditionals.** `if (experiment === 'A') { ... }`. Ships every variant's code to every user. Dead code accumulates. Cleanup requires grep across the codebase. SSR consistency is manual.

2. **Dynamic `import()` plus feature flags.** Lazy-loads the variant code. The flag evaluation library still ships to every user. The import map exposes variant file names to network observers. Variation inheritance does not exist. SSR coordination is manual.

3. **Feature flag SaaS** (LaunchDarkly, Statsig, Unleash). Flag SDK ships in every bundle. Flag names appear in network requests. Server and client flag evaluations must match — a frequent source of hydration bugs.

4. **Module Federation** (webpack 5, Rspack, Module Federation 2.0). Loads remote modules at runtime. Adds container protocol overhead. Requires conditional host code. Remote URLs are enumerable. No variation inheritance. No manifest-driven SSR coordination.

The common pattern: **the build system treats the user base as homogeneous; experimentation is bolted on at runtime**. Every runtime approach pays a payload tax, exposes experiment structure to the network, and pushes SSR consistency onto the developer.

Mendel rejects the premise. Variants are folders. The build system produces a separate dependency graph per variation. The server resolves the user's assignment before the response leaves; the client never sees variant choice happen.

## Structural Comparison

| Capability                                           | Mendel          | webpack / Rspack               | Vite / Rolldown | Turbopack       | Module Federation            |
| ---------------------------------------------------- | --------------- | ------------------------------ | --------------- | --------------- | ---------------------------- |
| A/B variant bundles, native                          | Yes             | No (runtime conditionals only) | No              | No              | Partial (runtime container)  |
| Zero payload overhead, guaranteed                    | Yes             | No                             | No              | No              | No (federation shell ships)  |
| Variation inheritance chains                         | Yes             | No                             | No              | No              | No                           |
| Content-addressed bundle URLs, no variant names      | Yes             | No                             | No              | No              | No (remote URLs visible)     |
| SSR variant resolution, automatic                    | Yes             | Manual                         | Manual          | Manual          | Very complex                 |
| Multilayer experiments without permutation explosion | Yes             | No                             | No              | No              | No                           |
| Experiment disposal                                  | `rm -rf folder` | Grep and delete conditionals   | Grep and delete | Grep and delete | Remove remote, update config |

The combination of zero payload overhead, declarative inheritance, opaque URLs, automatic SSR consistency, and multilayer composition does not exist in any other tool. Individual properties appear elsewhere (dynamic imports reduce payload; flag toggles are easy; git branches diff cleanly) but no alternative achieves all five in a unified system.

## The Closest Approximations and Why They Fall Short

**webpack Module Federation.** Serves different remote modules to different users at runtime. Theoretically deliverable as variant-aware bundling. Costs: runtime container protocol overhead, conditionals in host code to pick remotes, remote URLs that are enumerable, no variation inheritance model, no manifest-driven SSR coordination.

**Dynamic `import()` with feature flags.** A Vite or webpack app can lazy-load variant code behind a flag. The flag library itself ships to every user. The variant module names appear in the network panel. SSR must be manually coordinated. Variation inheritance does not exist; experiment B inheriting from experiment A requires two flags and two evaluation paths.

**Server-side feature flag evaluation.** Resolves flags server-side before render. The client never sees inactive variants. Still requires a flag SDK in server code, manual coordination between server render and client hydration, no filesystem inheritance, no content-addressed CDN per variation.

None of these replicate Mendel's filesystem model, declarative inheritance, or manifest-based runtime serving with zero overhead.

## Where Mendel Loses

**Build speed.** Mendel's Browserify foundation is slow by 2026 standards. A project with twenty variations runs twenty full bundle compilations. Rust-based tools (Rolldown, Rspack, Turbopack, Rolldown, Mako, Farm) complete equivalent work 5–30x faster.

**Dev experience.** Vite's native ESM dev server starts instantly and HMRs in milliseconds. Mendel's two-process daemon design predates that paradigm.

**Modern JS syntax.** Browserify is CommonJS-centric. ESM, TypeScript, JSX, CSS Modules require additional transforms. Newer tools handle these natively or zero-config.

**Ecosystem and plugins.** Mendel's plugin surface is Browserify-sized. webpack has thousands of loaders and plugins. Vite, Rspack, and Rolldown share Rollup's plugin protocol. Mendel's library is tiny by comparison.

**Active development.** Vite, Rolldown, Rspack, and Turbopack are backed by well-funded teams shipping releases weekly. Mendel lives under YahooArchive — not actively unmaintained, but not on the modern release cadence either.

**Documentation.** Vite and webpack have comprehensive docs and large community resources. Mendel has empty configuration documentation, stale design notes, and missing package READMEs. See current-state for the full inventory.

## Has Any Modern Tool Adopted Mendel's Model?

No. The 2026 bundler ecosystem has not produced a successor to Mendel's filesystem-folder variation model. Every Rust-based replacement (Rolldown, Rspack, Turbopack, Farm, Mako) targets faster general bundling and treats A/B testing as out of scope. The ecosystem consensus remains: experimentation belongs at the runtime layer.

Mendel's philosophy — experimentation is a build-time concern, and a build system designed around it can guarantee properties runtime approaches cannot — has no successor in the current ecosystem.

## The Concrete Path Forward

A modern Mendel rebuilt on Rolldown or Rspack for bundling, Vite's dev server for HMR, with the same filesystem-folder variation model and manifest-based runtime serving, would address the speed, DX, and modern-syntax gaps while preserving Mendel's structural guarantees. The design is proven; the implementation needs a 2026 runtime. No such project exists.
