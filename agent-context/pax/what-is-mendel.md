# What Is Mendel

Mendel is a JavaScript build tool for web applications that need to serve multiple distinct code variations to different users — A/B tests, feature experiments, white-label themes, partner customizations. It was built at Yahoo and hardened across teams ranging from three to thirty-plus developers on large production applications.

## The core model

Most experimentation tools work by injecting conditionals into the code: `if (experimentRunning) { /* alternative path */ }`. Mendel rejects this. Instead, it uses the filesystem. Each variation is a folder that mirrors the base source tree. You only place files in the variation folder when they differ from the base. At build time, Mendel merges the trees virtually — nothing is written to disk — and produces bundles for each variation.

```
src/                         experiments/new_checkout/    resolved/new_checkout/
├── components/cart.js  -->  (missing = use base)      -->  components/cart.js (base)
├── components/header.js --> components/header.js      -->  components/header.js **
└── pages/home.js       -->  (missing = use base)      -->  pages/home.js (base)
```

Files marked `**` come from the variation folder. All others come from the base. To dispose of an experiment, you delete its folder.

## Variation inheritance

Variations can inherit from other variations. If experiment `new_checkout_red` only changes a button color on top of `new_checkout`, the config expresses that chain:

```yaml
variations:
    new_checkout_red:
        - new_checkout_red # most specific: only the button file
        - new_checkout # inherits everything else from here
        # base is always appended implicitly
```

This lets teams build large feature variations with dozens of files and then run sub-experiments that change only one file, without duplicating the larger variation's work.

## Multilayer experimentation

Mendel supports running independent experiment layers concurrently. Layer 1 might control checkout flow experiments; Layer 2 might control ad format experiments. A single user is assigned one bucket per layer, and the layers are fully independent. Teams do not need to coordinate user allocation across layers. Mendel's build output handles any permutation of assignments at runtime without generating a bundle per permutation at build time.

## Build pipeline

Mendel v2+ is structured as a daemon/client system:

-   **Daemon**: long-running process that watches source files, runs Independent Source Transforms (IST: Babel, Bublé, UglifyJS, LESS), resolves dependency graphs, and holds a file cache per environment.
-   **Clients**: short-lived processes that consume the daemon's cache to run Graph Source Transforms (GST), Generators, and Outlets, then write final artifacts.

The pipeline steps in order:

```
FileReader → IST → GST → Generator → Outlet
```

**Types** map file extensions to transform pipelines. **Generators** perform graph-level operations like extracting node_modules into a separate vendor bundle or splitting bundles for lazy loading. **Outlets** define output format: browser-pack JavaScript, CSS, server-side render artifacts, or the production manifest.

The pipeline steps in order:

```
FileReader → IST → GST → Generator → Outlet
```

**Types** map file extensions to transform pipelines. **Generators** perform graph-level operations like extracting node_modules into a separate vendor bundle or splitting bundles for lazy loading. **Outlets** define output format: browser-pack JavaScript, CSS, server-side render artifacts, or the production manifest format.

## Production runtime

At build time, Mendel writes manifest files: JSON documents that contain the pre-transformed source for every variation of every file, indexed by a normalized module ID.

At runtime, `mendel-core` loads these manifests into memory once. For each HTTP request, it receives an array of active variation names, walks the manifest to assemble the correct file set, and generates a deterministic hash. That hash becomes the bundle URL. `mendel-middleware` is the Express-compatible wrapper that most production applications use over `mendel-core`.

The hash is opaque: it contains no experiment names. It encodes variation indices and a SHA1 of all file contents, which allows CDN caching without cookies and without `Vary` headers. If only one file changes in one variation between deploys, only the bundles that include that file get new hashes. All other cached URLs remain valid.

## Configuration

Configuration lives in `.mendelrc` (YAML), the `mendel` key of `package.json`, or a programmatic options object. They merge in that precedence order: `.mendelrc` wins over `package.json`, which wins over the programmatic default. `MENDEL_ENV` selects environment-specific overrides; it falls back to `NODE_ENV` when unset.

The key sections of `.mendelrc`:

-   `base-config`: the default variation's source folder and output directory
-   `variation-config`: declares variation directories and named variations with their folder inheritance chains
-   `transforms`: named transform plugins and their options
-   `types`: maps file extensions/globs to transform chains
-   `generators`: optional graph-level bundle operations
-   `outlets`: named output formats
-   `bundles`: entry points tied to an outlet and optional generator
-   `env`: per-environment overrides for types, bundles, and outlets

## What Mendel does not do

Mendel does not assign users to experiments. It does not measure outcomes. Those responsibilities belong to external tools (PlanOut, Optimizely, or any analytics stack). Mendel's scope is: given a set of active variation names for a user, produce the correct code bundle for that user, correctly and fast.
