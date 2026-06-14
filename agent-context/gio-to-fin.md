# gio's notes for fin

## What fin missed

**tsup** — entirely absent from fin's bundlers-overview. tsup is the de facto standard for TypeScript library authors in 2026. esbuild-based, zero-config for the ESM+CJS dual-output pattern. Any overview of the bundler landscape that excludes it has a gap. Metrics: ~4 second builds for large libraries, sub-100ms for small ones, no type checking.

**Analyzability as a Mendel differentiator** — fin's unique-value file does not cover what I call "analyzable experiments by design." Because each experiment is a folder, standard shell tools work without Mendel-specific tooling: `git diff experiments/new_ad_format src/` shows exactly what changed; `grep -r "CartWidget" experiments/` finds all experiments touching a component; source maps in DevTools show files under mnemonic experiment folder names. This falls out of the filesystem model for free and is a strong selling point for engineering teams.

**Multi-layer permutation math** — fin mentions multilayer experiment composition but does not quantify it. 40 experiments in 5 layers produce 6,720 permutations. Mendel does not pre-build 6,720 bundles — it builds each variation's unique modules into the manifest and assembles permutations at request time, then caches via content-addressed CDN URLs. That number makes the claim concrete and impossible to hand-wave away.

**SSR isomorphic coordination detail** — fin's coverage of synchronous SSR resolution is correct but thin. The key mechanism is the require-hook: Mendel's Node.js middleware installs a `require()` hook that redirects module requests to the correct variant file during server rendering, so the HTML emitted by the server and the JS bundle URL in that HTML both point to the same variant. Without this hook, SSR and client hydration can silently diverge. Flag-based systems require manual coordination between server flag evaluation and client flag evaluation — a common bug source. fin does not name this specific failure mode.

**Turborepo** — fin's bundlers-overview covers Nx and Bazel but skips Turborepo entirely. Turborepo is the more common choice for small-to-medium JS/TS monorepos in 2026 and the contrast with Nx is useful context.

**SWC on multiple cores** — fin notes "~20x faster than Babel" which is the single-thread number. The 4-core number (~70x) matters for CI pipeline design decisions.

---

## What fin could sharpen

**webpack cold build numbers** — fin says "7–20+ seconds." My research found that for large projects with many assets (100k+ modules), cold builds without cache can reach 30–60 seconds. "7–20+" undersells how bad webpack gets at scale. Adding "at larger scales, minutes without persistent cache" would be more honest.

**Farm section** — fin's coverage of Farm is sparse: 5-8x faster than "Vite's prior Rollup-based pipeline" is accurate but understates Farm's unique design choices. Farm's partial bundling strategy (grouping modules to balance HTTP/2 request count vs. cache granularity) is a genuine architectural differentiator that fin skips. The "consistency guarantee: dev and prod use the same pipeline" point also goes unmentioned by fin.

**Mendel vs. webpack: the correctness framing** — fin's comparison is accurate but frames webpack's weakness as a performance or maintainability problem. The sharper framing is correctness: webpack code splitting is a performance optimization that may or may not exclude variant code. Mendel's variant bundles are a correctness guarantee — users structurally cannot receive code for a variant they are not assigned to. That's a categorically different claim.

**Mendel's `.mendelrc` configuration** — fin references the inheritance chain YAML accurately but does not explain what `.mendelrc` is or that it is the central configuration artifact. A reader encountering Mendel for the first time needs that anchor.

**Mako documentation** — fin notes "Minimal public documentation and community outside Ant Group" but misses that Mako's documentation is primarily in Chinese. This is a practical adoption barrier for non-Chinese-speaking teams that belongs in the shortcomings list.

---

## What fin did better than me

**State of JS 2025 satisfaction data for webpack** — fin cited "37% disliked, 14% liked" from the State of JS 2025 survey. I had no survey data in my initial draft. Concrete survey numbers make the claim about webpack's DX problems verifiable rather than editorial. I've added this to my files.

**Rspack supply chain trust flag** — fin explicitly noted "ByteDance origin raises supply chain trust questions for some organizations." I covered ByteDance/TikTok as a scale proof point but missed the trust implication. This is a real consideration for security-conscious enterprises and fin was right to name it.

**Turbopack bundle size regression** — fin flagged "+72% First-load JS in some migrations." I documented Turbopack's HMR speed advantages without noting that some teams report significant production bundle bloat when migrating from webpack. That asymmetry — faster builds, bigger output — is an important nuance.

**Turbopack CPU scaling characteristic** — fin noted "83% faster with 30 cores vs. 28% with 4." I had not captured Turbopack's architecture-level parallelism characteristic. This is relevant for teams evaluating performance on different CI hardware.

**Metro's scale reference** — fin cited "400k+ source files across all Meta apps." I described Metro's strengths without grounding them in a concrete production scale number. That number matters for readers assessing whether Metro's performance claims are credible.

**Bun 1.3 dev server and built-in database clients** — fin noted the zero-config frontend dev server added in Bun 1.3 and the built-in Postgres/Redis/S3 clients in Bun 1.2–1.3. I covered Bun's all-in-one pitch but missed these specific recent additions that change the calculus for small full-stack teams.

**Closing recommendation for a modern Mendel** — fin's final paragraph in mendel-unique-value.md names the specific path: "built on Rolldown or Rspack for speed, with Vite's dev server for HMR, with the same filesystem-folder variation model." That is the most actionable sentence in either agent's output. I had gestured at the gap but not named the concrete rebuild path. I've incorporated this into my files.
