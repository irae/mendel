# Agent Context

The `agent-context/` directory contains research about this codebase produced by an adversarial multi-agent run: six independent agents (paired, competing) researched Mendel from three angles, cross-reviewed each other's findings, and an Opus agent synthesized the results. Read these files before working on Mendel to orient yourself quickly.

## Files

- **`01-what-is-mendel.md`** — What Mendel is and how it works: the filesystem-folder variation model, the IST/GST/Generator/Outlet pipeline, the daemon/client architecture, production manifest serving, and SSR support.

- **`02-why-choose-mendel.md`** — The technical case for Mendel: zero payload overhead by construction, CDN caching without `Vary` headers, `rm -rf` experiment disposal, variation inheritance, multilayer experimentation, opaque content-addressed URLs, automatic SSR/client consistency, and build speed.

- **`03-current-state.md`** — Honest assessment of Mendel today: onboarding friction, documentation gaps (empty `docs/Configuration.md`, no getting-started guide, no CLI reference), configuration gotchas, known architectural weaknesses with specific file references, and maintenance status.

- **`04-mendel-vs-ecosystem.md`** — How Mendel compares to 20+ JS build tools: the ecosystem's consensus approach to A/B testing (runtime SDKs, payload overhead), where Mendel wins and loses, the closest approximations (Module Federation, dynamic imports + flags), and why no modern bundler has adopted Mendel's model.

- **`05-architecture-deep-dive.md`** — Technical internals: pipeline phases with file references, multi-process worker design, key data structures (Entry lifecycle, normalizedId, MendelCache, manifest, variation chain), full package map for all 28 packages, architectural strengths, and specific weaknesses with TODO/FIXME locations.

Only read the files relevant to your current task. Do not load all five files by default.

## Source

Full research (individual agent folders, cross-review notes) lives on the `mendel-context-experiment` branch.
