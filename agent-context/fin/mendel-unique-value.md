# Mendel's Unique Value: What No Other Tool Does

## The Problem Mendel Solves That Others Ignore

Every bundler in the JavaScript ecosystem solves the same core problem: take N source files, produce M optimized output files for deployment. The implicit assumption behind all of them is: **one application, one user experience.**

Mendel rejects this assumption. Mendel's core premise is that production web applications run multiple simultaneous user experiences — A/B test variants — and the build system must treat this as a first-class concern, not an afterthought.

No other tool in this space does. Here is exactly what makes Mendel unique:

---

## 1. Filesystem-Folder Variation Model

Every other tool that supports A/B testing does so through one of these mechanisms:

-   **Runtime conditionals**: `if (experiment === 'variantA') { ... }` — ships all variant code to all users
-   **Dynamic imports**: `import('./variantA')` — lazy-loads the correct variant, but the import map reaches the client; experiment structure is visible
-   **Feature flags via SDK**: Unleash, LaunchDarkly, etc. — runtime evaluation, payload overhead, SDK code in the bundle
-   **Module Federation**: loads different module versions at runtime — variant URLs are discoverable by the client

Mendel's approach: **each variant is a folder**. Files in a variant folder override the corresponding files from the base. No conditionals. No dynamic imports. No SDK. The file system resolution produces a clean dependency graph for each variant at build time.

This model gives:

**Structural impossibility of payload leakage.** A user assigned to variant A never receives a byte of variant B's code. There is no mechanism by which variant B code enters the variant A bundle — it's excluded by the build, not by a runtime guard.

**Instant disposal.** Delete the folder. The experiment is gone. No grep-and-remove of conditionals, no dead code remaining in the module graph, no risk of accidentally leaving a conditional active.

**Diff-ability.** `diff src/views/ads.js experiments/new_ad_format/views/ads.js` shows exactly what changed. No conditional logic to untangle. Developer tools show variant source maps labeled with the variant name.

**Works with any file type.** Conditionals are JavaScript-only. Mendel's folder model works identically for JS, CSS, Less, JSON configuration, images — any file the bundler can process.

**Standard tools just work.** Because experiments are folders, the entire Unix and git toolchain applies without modification:

-   `git diff experiments/new_ad_format src/` shows exactly what changed between the experiment and base
-   `grep -r "CartWidget" experiments/` finds every experiment that touches a component
-   `ls experiments/new_ad_format/ | wc -l` shows experiment complexity at a glance
-   Source maps in browser DevTools show files under mnemonic experiment folder names

None of this requires Mendel-specific tooling. It falls out of the filesystem model for free.

---

## 2. Variation Inheritance with Explicit Composition

Mendel supports a declarative chain of folder inheritance:

```yaml
variations:
    new_ad_format_discreet:
        - new_ad_format_discreet # most specific: overrides what follows
        - new_ad_format_main # intermediate: base feature implementation
        # base is implicit last
```

This means: experiment `new_ad_format_discreet` only contains the files that differ from `new_ad_format_main`, which only contains the files that differ from base. Teams can build a large feature as one folder, then create lightweight sub-experiments that only override a few files — reusing the bulk of the feature code without duplication.

No other bundler has this. webpack, Vite, Parcel, esbuild, Rollup — none of them have a concept of "this variant inherits from this other variant."

The inheritance chain has explicit precedence — the same file resolution result every time, regardless of which file declares the override. This is the opposite of scattered conditionals, where a developer in one file might not know another file has already set the same flag.

---

## 3. Content-Addressed Bundle URLs That Hide Experiment Identity

Mendel's bundle URLs look like:

```
/mendel/bWVuZGVsAQAA_woAXorelKkTdpi858lasbIQRS6SCfw/main_app.js
```

The hash encodes the exact set of file versions for this variant combination. It encodes no human-readable experiment names. A user, a competitor, or a bad actor observing network traffic cannot determine:

-   Which experiments are running
-   Which experiments they are assigned to
-   Whether other experiments exist

The hash is computed like git's content-addressed object model: each file has a hash; each variation tree has a hash based on its file hashes; the bundle URL is derived from the tree hash. This means:

-   **Cache-safe**: only the bundles whose content actually changed get cache-busted between deployments
-   **CDN-friendly**: URLs are stable across users in the same experiment assignment; CDN serves the same URL to all users in the same bucket
-   **Cookie-less**: variation resolution happens on the server before the HTML is emitted; the CDN URL contains no session state

No other tool produces experiment-serving URLs with these properties. webpack Module Federation exposes remote URLs. feature flag SDKs expose flag names in API calls. Dynamic imports expose file names. Mendel's hash is opaque.

---

## 4. Synchronous Server-Side Variant Resolution for Isomorphic Apps

Mendel's production server middleware:

1. Receives a request with a bucket cookie (opaque blob encoding experiment assignments)
2. Parses the cookie to a list of experiment IDs — **no network call, no file system access**
3. Walks the in-memory manifest to compute the Mendel hash for this user's combination
4. Emits an HTML page with the correct CDN URL in the `<script>` tag

This is synchronous. The manifest is loaded into memory at server startup. Resolution is O(number of assigned experiments), typically microseconds.

For isomorphic (SSR) apps, Mendel also provides a Node.js module resolver that loads the correct variant files for server-side rendering, so the HTML rendered on the server matches the JavaScript bundle delivered to the client.

No other bundler provides this. webpack, Vite, Rspack — their SSR stories are about rendering framework components server-side. They have no mechanism for resolving "which version of each module does this specific user get" at request time, synchronously, without leaking experiment state to the client.

---

## 5. Multilayer / Multivariate Experiment Composition

Mendel supports serving combinations of variants from independent experiment layers. A user can be in experiment L1-B (from Layer 1) and experiment L2-C (from Layer 2) simultaneously. The manifest knows which files belong to each experiment; the hash function produces a unique, cacheable URL for each combination.

This means:

-   **Unlimited experiment space**: each layer can use 100% of users independently; layers multiply the experiment space without requiring teams to compete for user allocation
-   **Independent team operation**: different product teams own different layers and can run experiments without coordinating bucket allocation with other teams
-   **No pre-built permutation explosion**: Mendel does not build all permutations at deploy time (impractical at 6,700+ combinations). The manifest + runtime hash generation handles any combination on demand

No bundler or build tool handles this. General-purpose bundlers build a fixed set of output chunks. Feature flag SDKs handle assignment but not zero-overhead bundle delivery. Mendel is the only tool that ties experiment assignment directly to bundle content-addressing in a way that scales to multilayer scenarios.

---

## What This Means for Teams

Teams that use any other tool for A/B testing face a spectrum of trade-offs:

| Approach                       | Payload Overhead          | Disposability               | Security                        | SSR Support  | Inheritance            |
| ------------------------------ | ------------------------- | --------------------------- | ------------------------------- | ------------ | ---------------------- |
| Runtime conditionals           | High                      | Poor (grep + delete)        | Poor (names in code)            | Complex      | None                   |
| Dynamic imports / lazy loading | Medium (manifest visible) | Medium                      | Medium                          | Very complex | None                   |
| Module Federation              | Low-Medium                | Medium                      | Medium                          | Very complex | None                   |
| Feature flag SDKs              | SDK overhead always       | Good (flag toggle)          | Medium (flag names in requests) | Complex      | None                   |
| **Mendel**                     | **Zero**                  | **Trivial (delete folder)** | **High (opaque hashes)**        | **Native**   | **Declarative chains** |

The combination of all five properties simultaneously — zero overhead, trivial disposal, secure URLs, synchronous SSR resolution, and declarative inheritance — does not exist in any other tool. Individual properties appear elsewhere (dynamic imports reduce payload; feature flags are easy to toggle; git branches diff cleanly) but none of the alternatives achieve all five in a unified system.

---

## The Gap That Remains Open

No bundler created since Mendel has adopted its core model. Vite, Rolldown, Rspack, Turbopack, esbuild, Parcel — all of them optimize for building one version of an application. The ecosystem consensus is that A/B testing is an application-layer concern handled by runtime SDKs or feature flag services.

Mendel represents a different philosophy: **experimentation is a build-time concern**, and a build system designed around it can guarantee properties that runtime approaches cannot. That philosophy has no successor in the current ecosystem.

A modern version of Mendel — built on Rolldown or Rspack for speed, with Vite's dev server for HMR, with the same filesystem-folder variation model and manifest-based runtime serving — would be a uniquely valuable tool with no direct competitor.
