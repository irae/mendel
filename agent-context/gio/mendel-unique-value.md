# Mendel's Unique Value

What Mendel provides that no other build tool in the JavaScript ecosystem provides, and why the gap matters.

---

## The Core Problem Mendel Solves

Every major JavaScript bundler serves a single version of the application. When teams need to run A/B tests, they reach for one of three approaches, all of which carry costs:

1. **Runtime conditionals** (`if (experiment.enabled) ...`): Ships all variant code to all users. Creates technical debt. Hard to dispose of. Breaks grep-ability of the codebase.

2. **Dynamic `import()` with feature flags**: Lazy-loads variant code asynchronously. Adds request latency and flag evaluation code to the bundle. SSR coordination is manual and fragile.

3. **Separate deployments per variant**: Operationally expensive. No code reuse. Branch drift is a constant maintenance burden.

Mendel eliminates all three problems with a fourth approach that no other tool offers.

---

## What Mendel Does That Nothing Else Does

### 1. Filesystem Folder as Variant Definition

Mendel variants are filesystem folders that mirror the source tree. Only files that differ go in the folder. No conditionals, no decorators, no config flags in application code.

```
experiments/
  new_ad_format/
    controllers/sidebar.js   # overrides src/controllers/sidebar.js
    views/ads.js              # overrides src/views/ads.js
```

Deleting this folder removes the experiment from the next build. There is no other tool that makes experiment lifecycle management this mechanical.

No other bundler or build tool treats folder structure as the experiment definition language. webpack, Vite, Rollup, esbuild, Parcel, Turbopack, Rspack, Farm, Mako, and all monorepo tools have no concept of this.

---

### 2. Zero Payload Overhead: Guaranteed, Not Approximate

In every flag-based or code-splitting approach, users receive some overhead: the flag evaluation library, the async loader wrapper, or dead branches that were not stripped.

Mendel's model is structurally overhead-free. The server resolves the user's assigned variant before the HTML response. The manifest maps that variant assignment to a specific content-addressed bundle. The user's browser requests exactly one bundle — the one containing only the modules that apply to them.

There is no flag library. There is no async loader. There are no dead branches. The payload for a user in variant A is precisely the modules in variant A, nothing more.

---

### 3. Variation Inheritance: Declarative and Unambiguous

Experiments often build on other experiments. Mendel's inheritance chain is declared in `.mendelrc`:

```yaml
variations:
    new_ad_format_discreet:
        - new_ad_format_discreet # most specific
        - new_ad_format_main # inherits shared experiment code
        # base is always last
```

File resolution walks the chain: if `views/ads.js` exists in `new_ad_format_discreet`, use it. If not, check `new_ad_format_main`. If not, use base. There is no ambiguity and no implicit precedence.

No other build tool has this. webpack, Vite, and all Rust bundlers have no inheritance concept. The only analogue is CSS cascade, which is a language feature, not a build system feature.

---

### 4. Multi-Layer Experimentation Without Pre-Building All Permutations

Mendel supports multiple independent experiment dimensions (layers). A user can be simultaneously assigned to one experiment from layer 1 and one from layer 2. The manifest contains all individual variation modules. At runtime, the middleware combines them on-demand.

40 experiments in 5 layers can produce 6,720 permutations. Mendel does not pre-build 6,720 bundles. It builds each variation's unique modules into the manifest and assembles permutations at request time, then caches via content-addressed CDN URLs.

No other tool in this space handles this. Feature flag systems like LaunchDarkly track assignments but serve a single bundle. webpack Module Federation could theoretically support this with a complex remote loading scheme, but requires runtime containers, explicit host configuration, and adds request overhead per remote.

---

### 5. Content-Addressed Bundle URLs Without Variant Names

Mendel generates bundle URLs from a hash of the file list and file contents for a given variant combination. The URL contains no experiment name, no user identifier, and no variant ID.

```
/mendel/bWVuZGVsAQAA_woAXorelKkTdpi858lasbIQRS6SCfw/main_app.js
```

This URL is:

-   Cacheable on a CDN without cookies
-   Cookie-free (CDN can cache it globally)
-   Opaque (cannot be reverse-engineered to infer experiment names)
-   Stable across deployments if the relevant files did not change

Other bundlers produce content-hashed filenames (e.g., `main.a3f9bc.js`) but those hashes reflect file content only, not variant identity. Vite's and webpack's output filenames can expose module names and chunk names that correlate to feature names. Mendel's hash is a compound hash over the variant tree, not a single file.

---

### 6. Isomorphic Variant Delivery: Server and Client Render the Same Code

Mendel's Node.js middleware resolves the user's variant assignment from a cookie and provides a require-hook that redirects `require()` calls to the correct variant module. The server renders the correct variant server-side. The HTML response includes the bundle URL for the matching client bundle. Client hydration uses exactly the same code the server used to render.

This coordination is automatic and manifest-driven. With any flag-based approach, the developer must manually ensure the server flag evaluation matches the client flag evaluation — a common source of hydration mismatch bugs.

---

### 7. Analyzable Experiments by Design

Because each experiment is a folder, standard developer tools work without modification:

-   `git diff experiments/new_ad_format src/` shows exactly what changed
-   `grep -r "CartWidget" experiments/` finds all experiments touching a component
-   `ls experiments/new_ad_format/ | wc -l` shows experiment complexity at a glance
-   Source maps in browser DevTools show files under mnemonic experiment folder names

None of this requires Mendel-specific tooling. It falls out of the filesystem model for free.

---

## The Gap in the Ecosystem

A 2026 survey of the bundler ecosystem confirms: no tool except Mendel integrates variant delivery into the build system at the module resolution level. The ecosystem's answer to A/B testing is:

-   Use a feature flag SaaS (LaunchDarkly, Statsig, etc.) with a JS SDK that adds to bundle size
-   Use dynamic `import()` with flag evaluation
-   Write your own webpack plugin

Mendel is the only open-source build tool that treats experiments as a first-class build artifact, enforces zero payload overhead structurally, and handles SSR variant consistency automatically.

The combination of all five properties simultaneously — zero overhead, trivial disposal, secure URLs, synchronous SSR resolution, and declarative inheritance — does not exist in any other tool. Individual properties appear elsewhere (dynamic imports reduce payload; feature flags are easy to toggle; git branches diff cleanly) but none of the alternatives achieve all five in a unified system.

| Approach                       | Payload Overhead          | Disposability               | Security                        | SSR Support  | Inheritance            |
| ------------------------------ | ------------------------- | --------------------------- | ------------------------------- | ------------ | ---------------------- |
| Runtime conditionals           | High                      | Poor (grep + delete)        | Poor (names in code)            | Complex      | None                   |
| Dynamic imports / lazy loading | Medium (manifest visible) | Medium                      | Medium                          | Very complex | None                   |
| Module Federation              | Low-Medium                | Medium                      | Medium                          | Very complex | None                   |
| Feature flag SDKs              | SDK overhead always       | Good (flag toggle)          | Medium (flag names in requests) | Complex      | None                   |
| **Mendel**                     | **Zero**                  | **Trivial (delete folder)** | **High (opaque hashes)**        | **Native**   | **Declarative chains** |

No bundler created since Mendel has adopted its core model. Vite, Rolldown, Rspack, Turbopack, esbuild, Parcel — all optimize for building one version of an application. The ecosystem consensus is that A/B testing is an application-layer concern handled by runtime SDKs or feature flag services.

Mendel represents a different philosophy: experimentation is a build-time concern, and a build system designed around it can guarantee properties that runtime approaches cannot. That philosophy has no successor in the current ecosystem.

---

## Where Mendel Has Gaps vs. the Current Ecosystem

Mendel's design is strong but its implementation has not kept pace with the bundler ecosystem:

-   **Speed**: Mendel is built on Browserify, which is far slower than any Rust-based bundler. A Mendel-equivalent system built on Rolldown or Rspack would be 10-50x faster to build.
-   **Dev experience**: Mendel's dev server lacks the instant HMR and ESM serving that Vite provides.
-   **Modern syntax**: No native ESM output; the Browserify foundation limits the output format.
-   **Ecosystem size**: Mendel is a Yahoo/Verizon internal tool released open-source. Plugin ecosystem and community support are minimal compared to Vite or webpack.
-   **Documentation**: The design is well-documented but tooling and examples are sparse.
-   **Active maintenance**: The YahooArchive repo signals reduced active maintenance.

The concept Mendel pioneered remains unmatched. The implementation needs a modern runtime to remain competitive.
