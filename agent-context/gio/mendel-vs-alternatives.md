# Mendel vs. Alternatives: Direct Comparison

## What Mendel Is

Mendel is not a general-purpose bundler. It is a build toolchain for serving A/B test variants of isomorphic web applications. It uses Browserify under the hood for module resolution and was built on top of it. Its design goal is zero payload overhead, zero runtime conditionals, and zero variation metadata in client-side URLs — while supporting isomorphic (SSR) rendering, multi-layer experiments, and variation inheritance.

The correct comparison is not "Mendel vs. Vite" but "how would you achieve Mendel's goals using each alternative tool."

---

## Comparison Table

| Tool             | General Bundling            | A/B Variant Bundles        | SSR Variant Support    | Zero Payload Overhead       | No Runtime Conditionals | Variation Inheritance   | Content-Addressed CDN | Security (no variant names in URLs) | Immediately Disposable Experiments |
| ---------------- | --------------------------- | -------------------------- | ---------------------- | --------------------------- | ----------------------- | ----------------------- | --------------------- | ----------------------------------- | ---------------------------------- |
| **Mendel**       | No (uses Browserify)        | Yes (native, core feature) | Yes (manifest-driven)  | Yes                         | Yes                     | Yes (declarative chain) | Yes (hash-based)      | Yes                                 | Yes (delete folder)                |
| **webpack**      | Yes                         | Partial (code splitting)   | Yes (with SSR plugins) | No (dead code in bundle)    | No                      | No                      | No (needs CDN config) | No (chunk names visible)            | No                                 |
| **Vite**         | Yes                         | No                         | Yes (SSR mode)         | No (variant code in bundle) | No                      | No                      | No                    | No                                  | No                                 |
| **Rollup**       | Yes (libraries)             | No                         | No                     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Parcel**       | Yes                         | No                         | Limited                | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **esbuild**      | Yes (low-level)             | No                         | No                     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Turbopack**    | Yes (Next.js only)          | No                         | Yes (Next.js only)     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Rspack**       | Yes                         | Partial (code splitting)   | Yes                    | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Rolldown**     | Yes                         | No                         | No                     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Farm**         | Yes                         | No                         | Yes (partial)          | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Mako**         | Yes                         | No                         | Yes (Ant ecosystem)    | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Browserify**   | Yes (legacy)                | No                         | No                     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Metro**        | Yes (React Native)          | No                         | No                     | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Nx/Turborepo** | No (orchestrates bundlers)  | No                         | N/A                    | No                          | No                      | No                      | No                    | No                                  | No                                 |
| **Bazel**        | No (orchestrates compilers) | No                         | N/A                    | No                          | No                      | No                      | No                    | No                                  | No                                 |

---

## Tool-by-Tool Analysis

### Mendel vs. webpack

**Where webpack wins:**

-   General application bundling for teams not running A/B tests
-   Module Federation for micro-frontend architectures
-   Legacy browser support
-   Plugin ecosystem breadth

**Where Mendel wins:**

-   A/B variant delivery without payload overhead: webpack code splitting sends both variant code paths to users who will never execute one of them. Mendel sends only the code the assigned user needs.
-   No runtime conditionals: webpack-based A/B testing requires `if(flagEnabled)` guards or async `import()` calls in source code. Mendel uses folder structure — no application code changes.
-   Variation inheritance: webpack has no concept of file-level variation inheritance chains. Achieving this would require manual code duplication or a custom plugin.
-   Security: webpack chunk names can expose experiment names in network traffic. Mendel URLs contain only a content hash.
-   Disposability: removing a webpack-based experiment means finding and deleting all conditional guards across the codebase. Mendel: delete a folder.

**Fundamental gap:** webpack's code splitting is a performance optimization for reducing initial load. Mendel's variant bundles are a correctness guarantee — users cannot access code they are not assigned to.

---

### Mendel vs. Vite

**Where Vite wins:**

-   Dev server speed: instant startup via native ESM, best-in-class HMR
-   Ecosystem size and framework support (React, Vue, Svelte, etc.)
-   Zero-config for most apps
-   Active development: Vite 8 with Rolldown is the cutting edge in 2026

**Where Mendel wins:**

-   Everything in the A/B testing column: Vite has no concept of variants, variation inheritance, or manifest-driven runtime bundle selection
-   SSR variant consistency: Mendel's manifest ensures server and client render the same variant. Vite SSR mode does not coordinate with an experiment assignment system.
-   No payload overhead: Vite bundles everything into chunks that may include unused variant code
-   Production security: Vite output filenames are hashed by content but expose module names; Mendel's manifest routes via opaque hash

**Fundamental gap:** You can build an app with Vite and add a feature flag SDK on top, but you cannot replicate Mendel's filesystem-folder model, variation inheritance, or manifest-based multi-permutation serving without custom build plugins that don't exist.

---

### Mendel vs. Rollup

**Where Rollup wins:**

-   Library bundling: produces the cleanest ESM/CJS output
-   Tree-shaking quality

**Where Mendel wins:**

-   Every A/B testing concern: Rollup has no app serving model, no manifest, no variant concept

**Fundamental gap:** Rollup is a library bundler; Mendel is an app delivery system. Not comparable in mission.

---

### Mendel vs. Parcel

**Where Parcel wins:**

-   Zero-config app bundling
-   Fast prototyping

**Where Mendel wins:**

-   All A/B testing concerns

---

### Mendel vs. esbuild

**Where esbuild wins:**

-   Raw build speed (10-100x faster)
-   TypeScript transpilation speed
-   Low-level scripting and pipeline use

**Where Mendel wins:**

-   All A/B testing concerns
-   esbuild has no manifest, no variant model, no runtime coordination

---

### Mendel vs. Turbopack

**Where Turbopack wins:**

-   Incremental rebuild speed (9.5x faster than webpack for Next.js)
-   Deep Next.js integration

**Where Mendel wins:**

-   Framework-agnostic: Mendel works with any isomorphic app; Turbopack is Next.js-only
-   All A/B testing concerns

---

### Mendel vs. Rspack

**Where Rspack wins:**

-   5–23x faster than webpack 5; 1.4s cold builds in benchmarks
-   Drop-in webpack replacement: ~85% of top 50 plugins work without changes
-   Module Federation 2.0
-   Production-proven at ByteDance/TikTok/Lark scale

**Where Mendel wins:**

-   All A/B testing concerns
-   No payload overhead
-   Rspack's Module Federation still uses runtime decisions — the federation shell and all potential remotes are discoverable by the client. Mendel's opaque hash gives no information about which experiments exist or which the user is assigned to

---

### Mendel vs. Rolldown

**Where Rolldown wins:**

-   Speed: single-pass Rust bundling
-   Rollup-compatible API

**Where Mendel wins:**

-   All A/B testing concerns; Rolldown is a bundling engine, not an experiment delivery system

---

### Mendel vs. Farm

**Where Farm wins:**

-   Build speed (6x faster than Vite, 10ms HMR)
-   Vite plugin compatibility
-   General-purpose web app bundling

**Where Mendel wins:**

-   All A/B testing concerns

---

### Mendel vs. Mako

**Where Mako wins:**

-   Production-proven at Ant Group scale
-   Zero-config for its target ecosystem

**Where Mendel wins:**

-   All A/B testing concerns
-   Framework-agnostic

---

### Mendel vs. Monorepo Tools (Nx, Turborepo, Bazel, Rush)

These are not bundlers. They orchestrate tasks across packages, including calling bundlers. They have no overlap with Mendel's core feature set.

**Where they win:**

-   Coordinating builds across dozens or hundreds of packages
-   Task caching and remote caching
-   Code generation, architectural enforcement (Nx)
-   Hermetic reproducibility (Bazel)

**Where Mendel wins:**

-   Serving A/B variants at the bundle level; these tools have no concept of it

---

## The Closest Approximations to Mendel's Model (and why they fall short)

**webpack Module Federation:** Loads remote modules from separate deployments at runtime. Could theoretically deliver different code to different users by serving different remote URLs. But: (a) adds a runtime container protocol overhead, (b) requires conditionals in host code to choose which remote to load, (c) exposes remote URLs which can be guessed, (d) no variation inheritance model, (e) no manifest-driven SSR coordination.

**Dynamic `import()` with feature flags:** A Vite or webpack app can lazy-load variant code behind a flag. But: (a) the flag logic itself adds payload, (b) the user's browser still downloads the flag evaluation code for all users, (c) no variation inheritance, (d) SSR must be manually coordinated, (e) experiment names appear in code and network traffic.

**Server-side feature flag evaluation (LaunchDarkly, etc.):** Flag is resolved server-side; the client never sees inactive variants. Still requires: (a) flag SDK in server code, (b) manual coordination between server render and client hydration, (c) no filesystem-based inheritance model, (d) no content-addressed bundle hashing per variant.

None of these replicate Mendel's filesystem folder model, declarative inheritance chains, or manifest-based runtime serving of arbitrary variant permutations with zero overhead.

---

## What a Modern Mendel Would Look Like

Mendel's design philosophy has no competitor, but its Browserify implementation is a decade behind the bundler ecosystem. A modern rebuild — using Rolldown or Rspack as the bundling engine, Vite's dev server for HMR, and the same filesystem-folder variation model with manifest-based runtime serving — would be a uniquely valuable tool with no direct competitor. The design is proven. The implementation needs a modern runtime.
