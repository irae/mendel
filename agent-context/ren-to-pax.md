# ren's notes for pax

## What pax missed

**CLI reference gap.** Pax's documentation-gaps file never mentions that no `mendel` CLI reference exists. The Roadmap called this out as a v2 goal that was never delivered. A user running `mendel --help` gets output, but no man-page equivalent exists in docs. This is a critical gap for first-time users.

**Migration guide — no mention.** Mendel has at least three distinct architectural versions (v1 Browserify plugin, v2 daemon/client architecture, v4 updated hash algorithm). The `.mendelrc` structure changed significantly between v1 and v2: `variationsdir` became `variation-config.variation-dirs`, config restructured around `base-config`. No document maps what changed or how to migrate. Pax did not identify this gap at all.

**Stale contributor instructions in README.** The main `README.md` tells contributors to run `npm run bootstrap`. The actual current workflow (from `DEVELOPMENT.md`) uses `pnpm install` and `pnpm lerna exec "pnpm link --global"`. A new contributor following README instructions cannot set up a dev environment. Similarly, `docs/Tests.md` references `npm run linkall`, which does not exist in the current pnpm workspace. Pax missed both of these.

**`MENDEL_ENV` vs `NODE_ENV` interaction is undocumented.** `mendel-config/README.md` mentions both environment variables but does not explain what happens when both are set or which takes precedence. The full-example test scripts use `MENDEL_IPC=.mendelipc-test MENDEL_ENV=test` without any prose explanation. Pax did not call this out.

**Variation inheritance syntax change in Design.md.** `docs/Design.md` shows both the original JSON syntax and the current YAML syntax for variation inheritance side by side, with a note saying "this section needs reviewing." A new reader cannot tell which syntax is current. Pax did not surface this.

**Glossary missing from user docs.** A first-time reader encounters: variation, bucket, layer, IST, GST, generator, outlet, manifest, daemon, client, normalized ID, entry, tree, bundle, base. A glossary exists only in the internal `packages/mendel-pipeline/docs/DEVELOPMENT-README.md`. Pax did not identify this gap.

**`types:` concept has no explanation of what it replaced.** The v2 config introduces `types:` to assign transforms to file extensions. The v1 config used Browserify transforms directly on bundles. No user-facing document explains the shift or why types exist. Pax didn't flag this.

**Multilayer usage has no example.** Pax's files explain the multilayer concept well in what-is and why-choose, but pax never flagged that the `full-example` does not demonstrate multilayer usage and no user-facing doc shows how to declare layers in `.mendelrc` or how the server handles multi-layer assignments. This belongs in the documentation-gaps file.

**Production deployment checklist gap.** The four-step production deployment sequence (build manifests, swap all outlets to manifest, start middleware, point CDN) has no documented checklist. The requirement to switch every bundle's outlet — not just a global flag — is easy to miss and only visible as a comment in the full-example's `.mendelrc`. Pax's production outlet-swap entry notes the gap but does not describe the full sequence.

## What pax could sharpen

**Rough edge #5 (variation directory naming collisions) lacks context.** Pax states the constraint that variation folder names must be globally unique across all `variation-dirs`. But pax does not explain why this matters: Mendel uses folder names as variation identifiers, so a name appearing in two roots creates an ambiguous resolution. The "why" matters for a developer deciding how to structure their project.

**The roadmap staleness entry needs a concrete example of the damage.** Pax notes the Roadmap describes v2 goals already implemented. What pax misses: a reader of the Roadmap today sees "multi-core support" as aspirational and might assume Mendel is single-threaded, then choose a different tool. The harm is not just that the doc is old — the harm is it creates false impressions about current capability.

**The security section in why-choose-mendel needs the development mode caveat.** Pax's security entry in why-choose correctly notes that production bundles contain no experiment name references. It should note that development mode does expose mnemonic folder names in source maps — this is a deliberate tradeoff, and readers making security decisions need to know it.

**ManifestValidation.md forward-link problem is well-described but incomplete.** Pax notes this document is not linked from the README. The deeper problem is that the error message itself (`Files with same variation (base) and id (body.js) should have the same SHA`) uses the word "SHA" in a way that points developers toward content mismatch, not path mismatch. Pax's entry would be stronger if it named the mismatch in what the error says versus what actually caused it.

## What pax did better than me

**Pipeline diagram.** Pax's `FileReader → IST → GST → Generator → Outlet` pipeline diagram with accompanying explanation of what each stage does is cleaner and more precise than what I had. I had spread this information across bullet points; pax structured it as a pipeline, which is how Mendel itself describes it.

**Visual merge diagram.** Pax's three-column diagram showing `src/` + `experiments/new_checkout/` → `resolved/new_checkout/` with the `**` marker for variation files is the clearest single illustration of how Mendel's resolution works. My file explained the same concept in prose; pax's diagram makes it scannable.

**Production outlet swap as a standalone rough edge.** Pax identified the outlet swap as rough edge #4 with the correct observation that there is no "switch all bundles to manifest in production" shorthand. My treatment buried this inside the production deployment section without naming it as a distinct friction point.

**`mendel-outlet-server-side-render` and `mendel-mocha-runner` have no READMEs.** Pax caught that these two packages have no README at all — not just thin documentation. I had a table of packages with poor docs but missed that these two have zero documentation.

**Implicit base variation appended to inheritance chains — called out clearly.** Pax named this as a standalone rough edge. I mentioned it only in the context of the configuration reference gap. Pax is right that it deserves its own entry: a developer debugging a resolution chain who does not know about the implicit base will spend significant time confused.
