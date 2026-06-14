# fin's notes for gio

## What gio missed

**tsup** — the zero-config TypeScript library bundler built on esbuild. It is the dominant tool for bundling npm packages written in TypeScript in 2026 and deserves a mention in any bundler overview. Rollup is what people _say_ they use for libraries; tsup is what they actually reach for.

**Parcel's parallel compilation** — gio notes Parcel is good for prototypes but misses that Parcel runs compilation in worker processes, giving it real parallel throughput and ~10ms HMR on medium projects. That is a more precise strength than "zero-config."

**Rollup's CommonJS interop friction** — gio covers Rollup's strengths and library focus accurately but does not note that CJS interop is one of Rollup's persistent pain points. Teams mixing CJS and ESM packages hit this regularly.

**Rspack's ByteDance origin as a trust concern** — gio notes Rspack's plugin compatibility gap, but supply chain trust questions for organizations evaluating Rspack (ByteDance origin, TikTok affiliation) are a real adoption blocker worth documenting.

**Metro's scale** — gio covers Metro correctly as React Native-only and slow, but misses that Metro is battle-tested at Meta scale across 400k+ source files. That fact reframes "slow" as a deliberate trade-off, not a lack of investment.

**Bun's Postgres/Redis/S3 built-ins** — gio notes Bun is all-in-one but does not mention that Bun 1.2–1.3 added native Postgres, Redis, and S3 clients. This is relevant to teams evaluating Bun as a full backend stack, not just a bundler.

**Webpack benchmark precision on medium projects** — gio gives "30-60 seconds for cold builds" which is accurate for large projects but will read as wrong to someone with a medium app that sees 10-15 seconds. Both ranges are correct for different scales; stating both is more accurate.

**Variation inheritance concrete failure modes in flag-based systems** — gio's "Closest Approximations" section describes why LaunchDarkly and dynamic imports fall short, but does not name the specific failure: when experiment B inherits from experiment A using flags, you need two flags, two evaluation paths, and risk inconsistency between server and client evaluations of both. Mendel's inheritance chain removes that entire class of bugs.

---

## What gio could sharpen

**The comparison table in mendel-vs-alternatives.md** — gio's table is good, but "Partial (code splitting)" for webpack's A/B variant column is misleading. Code splitting is a performance optimization; it does not achieve variant isolation. A more precise entry would be "Runtime only, with overhead" to make the distinction clear.

**Turbopack section** — gio says Next.js 16 shipped in January 2026, but the actual date was closer to late 2025 (gio's own bundlers-overview says "January 2026," while my research showed October 2025). One of those is wrong and should be verified. The precise date matters less than being internally consistent.

**The "Analyzable Experiments by Design" section** — gio names this as a unique Mendel value but frames it as a list of Unix commands rather than explaining _why_ this matters. The point is not that `grep` works — it is that standard developer tooling works without requiring Mendel-specific knowledge, which lowers onboarding cost for every new engineer on the team.

**Farm's partial bundling** — gio notes Farm's "partial bundling" feature (grouping modules intelligently to balance HTTP request count vs. caching) but does not explain what it is or why it matters. This is one of Farm's most interesting differentiators and deserves a sentence of explanation.

**The gap discussion in mendel-unique-value.md** — gio's "Where Mendel Has Gaps" section is accurate but lists gaps in isolation. Connecting them to a concrete path forward (e.g., "a Mendel rebuilt on Rolldown would address the speed and ESM gaps while keeping the variation model") would make the analysis more useful.

---

## What gio did better than me

**Category organization in bundlers-overview.md** — gio organized tools into explicit categories (General-Purpose Bundlers, Rust-Based Next-Generation Bundlers, Compilers/Transformers, Retired/Deprecated, Monorepo Orchestrators). I listed tools chronologically with no grouping. Gio's structure makes the overview much faster to navigate and makes it easier to see which tools compete directly with each other.

**The "Closest Approximations" section in mendel-vs-alternatives.md** — gio built out a dedicated section breaking down webpack Module Federation, dynamic imports with feature flags, and server-side flag evaluation as the three closest things to Mendel — and systematically showed why each falls short. I did not have this section at all. It is the right way to preempt the objection "can't you just use LaunchDarkly?"

**The comparison table's additional columns** — gio added "Content-Addressed CDN," "Security (no variant names in URLs)," and "Immediately Disposable Experiments" as explicit table columns. I had fewer columns. Gio's columns make Mendel's advantages immediately visible at a glance without reading the prose.

**Specifying the YahooArchive signal** — gio explicitly names the YahooArchive GitHub organization as evidence of reduced active maintenance. I described reduced maintenance in general terms. The specific repo organization name is a verifiable, concrete signal that a reader can check.

**Vite 8 metrics specificity** — gio cited concrete numbers for Vite 8: "3x faster dev startup, 40x fewer network requests in dev, 10x faster production builds." I had "10–30x faster than Rollup" for Rolldown but not the full Vite 8 package in one place. Gio's version is more useful for readers evaluating Vite 8.
