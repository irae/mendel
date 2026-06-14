# Mendel vs. Alternatives: Direct Comparison

## What Mendel Actually Is

Mendel is not a general-purpose bundler. It is an **experimentation delivery system** built on top of a bundler (historically Browserify). Its job is to produce and serve per-variation JavaScript bundles for A/B testing without runtime conditionals, without payload overhead, and without leaking experiment names into URLs.

Every comparison below must be read with this distinction: Mendel is not competing with webpack for the job of "bundle my app." It competes for the job of "run A/B tests on my app's frontend with zero overhead."

---

## Comparison Table

| Tool       | General Bundling           | A/B / Variant Serving           | SSR Variant Support | Zero Payload Overhead       | Variation Inheritance | Secure URLs (no variant names) | Content-Addressed CDN | Immediately Disposable | Dev Workflow                 |
| ---------- | -------------------------- | ------------------------------- | ------------------- | --------------------------- | --------------------- | ------------------------------ | --------------------- | ---------------------- | ---------------------------- |
| **Mendel** | Limited (Browserify-based) | Native, first-class             | Yes                 | Yes                         | Yes (folder chains)   | Yes (hash, no names)           | Yes (hash-based)      | Yes (delete folder)    | Fast HMR target <300ms       |
| webpack    | Excellent                  | Via Module Federation (runtime) | Via SSR frameworks  | No (conditionals ship code) | No native model       | No (chunk names visible)       | No                    | No                     | Slow (7–20s cold start)      |
| Rollup     | Library focus              | None native                     | No                  | N/A                         | No                    | N/A                            | No                    | No                     | No HMR                       |
| Vite       | Excellent                  | None native                     | Via frameworks      | No (conditionals)           | No                    | No                             | No                    | No                     | Excellent (native ESM)       |
| Rolldown   | Excellent (Vite 8)         | None native                     | Via frameworks      | No                          | No                    | No                             | No                    | No                     | Excellent                    |
| Rspack     | Excellent                  | Via Module Federation           | Via SSR frameworks  | No                          | No                    | No                             | No                    | No                     | Good (~webpack speed × 5–10) |
| Turbopack  | Next.js only               | None native                     | Next.js RSC only    | No                          | No                    | No                             | No                    | No                     | Excellent (Next.js only)     |
| Parcel     | Good                       | None                            | No                  | No                          | No                    | No                             | No                    | No                     | Good                         |
| esbuild    | Limited (tooling use)      | None                            | No                  | No                          | No                    | No                             | No                    | No                     | N/A                          |
| Bun        | Good                       | None                            | Limited             | No                          | No                    | No                             | No                    | No                     | Good                         |
| Metro      | React Native only          | None                            | Via React Native    | No                          | No                    | No                             | No                    | No                     | Good (RN only)               |
| Nx         | Orchestrator only          | None                            | N/A                 | No                          | No                    | No                             | No                    | No                     | Orchestration layer          |
| Bazel      | Polyglot, complex          | None                            | No                  | No                          | No                    | No                             | No                    | No                     | High overhead                |

---

## Mendel vs. webpack

### webpack wins:

-   General application bundling: webpack handles every asset type, has decades of plugins and loaders, and supports the widest range of project configurations
-   Module Federation: the most mature mechanism for runtime code sharing across micro-frontends
-   Ecosystem depth: every edge case has a plugin

### Mendel wins:

-   **Payload overhead**: webpack A/B testing requires runtime conditionals or dynamic imports — either approach ships code for all variants to some users. Mendel ships only the code the user's assigned variant needs
-   **Variation maintainability**: webpack has no model for organizing experiment code. Conditionals accumulate, become hard to remove, and pollute the main module graph. Mendel's folder model makes disposal trivial (delete a directory)
-   **Security**: webpack Module Federation or conditional-based experiments embed variant identifiers in bundle URLs or source code. Mendel hashes obscure experiment names from the URL entirely
-   **SSR isomorphic variants**: webpack has no built-in mechanism to serve the correct variant bundle for SSR. Mendel's server middleware resolves variants synchronously on each request using a pre-loaded manifest

### The core gap:

webpack treats A/B testing as a secondary concern. Module Federation can approximate multi-version serving but requires runtime decisions that add payload and complexity. Mendel treats experimentation as the primary concern — everything is designed around it.

---

## Mendel vs. Vite

### Vite wins:

-   Dev speed: native ESM, instant server start, HMR in milliseconds. Vite's dev experience is far superior
-   Ecosystem: Vue, React, Svelte, Solid all have first-class Vite support
-   Modern JS features: TypeScript, CSS Modules, JSX — all zero-config
-   Production bundle quality: Rolldown (Vite 8) produces highly optimized output

### Mendel wins:

-   **Variant isolation**: Vite has no concept of A/B variants. Teams using Vite for experiments write `if (experiment === 'variantA')` — which ships all variant code to all users
-   **Variation inheritance**: Vite has no mechanism to say "experiment B inherits from experiment A, which inherits from base." Mendel's folder chain config handles complex multi-layer compositions declaratively
-   **Zero overhead enforcement**: Mendel's architecture makes it structurally impossible to accidentally ship unused variant code. With Vite, a lazy import is the best you can do — but the import manifest itself still reaches the client
-   **Server-side variant resolution**: Vite has no server middleware that resolves which bundle to serve based on a user's experiment assignment

### The core gap:

Vite is a general-purpose build tool with no experimentation primitives. Any A/B testing on top of Vite requires application-level code that introduces the very problems Mendel was designed to eliminate.

---

## Mendel vs. Rollup / Rolldown

### Rollup/Rolldown wins:

-   Tree shaking: best-in-class for library code
-   Build speed (Rolldown): 10–30x faster than Rollup, now powering Vite 8
-   Output quality: clean, minimal bundles ideal for npm packages

### Mendel wins:

-   Everything related to experimentation — Rollup and Rolldown have no variant or experiment concepts whatsoever
-   Application bundling with multiple live variations is simply not in their design space

### The core gap:

Rollup/Rolldown are tools for producing one optimal bundle. Mendel produces N bundles — one per variation — and a manifest for runtime composition.

---

## Mendel vs. Rspack

### Rspack wins:

-   Build speed: 5–23x faster than webpack, near drop-in replacement
-   webpack ecosystem compatibility: ~85% of plugins work without changes
-   Module Federation: same MF capabilities as webpack 5, but faster
-   Scale: proven at ByteDance/TikTok production scale

### Mendel wins:

-   Same advantages as vs. webpack: no native experiment model, no zero-overhead variant serving, no isomorphic variant resolution
-   Rspack's Module Federation still uses runtime decisions — the bundle served to a user contains only what's federation-loaded at runtime, but the federation shell and all potential remotes are discoverable

---

## Mendel vs. Turbopack

### Turbopack wins:

-   Raw dev performance: 10x faster HMR than webpack within Next.js
-   Zero-config for Next.js users

### Mendel wins:

-   Turbopack is locked to Next.js and has no standalone use
-   No experiment model; no variant isolation; no secure bundle URLs
-   Framework-agnostic: Mendel works with any server-rendered Node.js app

---

## Mendel vs. Parcel

### Parcel wins:

-   Zero config for general app development
-   Parallel compilation, fast HMR (~10ms)
-   Handles more asset types natively

### Mendel wins:

-   Same story: no experiment model in Parcel
-   Mendel's configuration (`.mendelrc`) is also relatively simple given what it accomplishes

---

## Mendel vs. esbuild

### esbuild wins:

-   Raw build speed (Go, sub-second)
-   Perfect for tooling, CI pipelines, CLIs

### Mendel wins:

-   esbuild is not an application bundler and has no experiment model
-   No HMR, no server middleware, no variant resolution

---

## Mendel vs. Metro

### Metro wins:

-   React Native: the only real choice for RN production apps
-   Optimized for Hermes JS engine and mobile bundle constraints

### Mendel wins:

-   Web-native: Metro is irrelevant outside React Native
-   No A/B variant model in Metro — RN experiment handling is typically done via feature flag SDKs with runtime conditionals

---

## Mendel vs. Nx / Bazel

These are build orchestrators, not bundlers with variant models. Neither Nx nor Bazel has any concept of A/B experiment variants. They operate at the task scheduling and caching layer; the actual JS bundling is delegated. Mendel is orthogonal — you could theoretically run Mendel builds inside an Nx or Bazel task graph.

---

## The Closest Approximations to Mendel's Model (and why they fall short)

**webpack Module Federation:** Loads remote modules from separate deployments at runtime. Could theoretically deliver different code to different users by serving different remote URLs. But: (a) adds a runtime container protocol overhead, (b) requires conditionals in host code to choose which remote to load, (c) exposes remote URLs which can be guessed, (d) no variation inheritance model, (e) no manifest-driven SSR coordination.

**Dynamic `import()` with feature flags:** A Vite or webpack app can lazy-load variant code behind a flag. But: (a) the flag logic itself adds payload, (b) the user's browser still downloads the flag evaluation code for all users, (c) no variation inheritance, (d) SSR must be manually coordinated, (e) experiment names appear in code and network traffic.

**Server-side feature flag evaluation (LaunchDarkly, etc.):** Flag is resolved server-side; the client never sees inactive variants. Still requires: (a) flag SDK in server code, (b) manual coordination between server render and client hydration, (c) no filesystem-based inheritance model, (d) no content-addressed bundle hashing per variant.

None of these replicate Mendel's filesystem folder model, declarative inheritance chains, or manifest-based runtime serving of arbitrary variant permutations with zero overhead.

---

## Where Mendel Loses Across the Board

**Build speed:** Mendel's Browserify foundation is slow by 2026 standards. A project with 20 experiments could require 20 full bundle compilations. Modern Rust-based tools would complete the same work in a fraction of the time.

**Modern JS syntax:** Browserify is CommonJS-centric. ESM, TypeScript, JSX, CSS Modules all require additional transforms and configuration. Newer tools handle these natively.

**Ecosystem:** Mendel's plugin/transform ecosystem is Browserify-sized — tiny by comparison to webpack's or Vite's.

**Single-framework origin:** Mendel was built at Yahoo in a specific architectural context (Ember, then React with server rendering). Its assumptions don't always map cleanly to other setups.

**Community and maintenance:** Mendel is not actively maintained by a large team or backed by significant commercial interest. The YahooArchive GitHub organization signals reduced active maintenance. Vite, Rspack, and Rolldown are all backed by well-funded teams.

**Developer experience:** Vite's native ESM dev server is a fundamentally better developer experience than Mendel's Browserify-based watch mode.
