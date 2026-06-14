# Package Catalog

## Core

-   `mendel-config`: Loads `.mendelrc` or `package.json`, merges overrides, resolves paths, and normalizes bundle/variation config.
-   `mendel-core`: Reads production manifests and resolves variation trees and hashes per request.
-   `mendel-pipeline`: Build system and CLI. Wires config, cache, watch, transforms, dependency resolution, generators, and outlets.
-   `mendel-development`: Shared dev-time helpers for variation matching, source rewriting, manifest sorting, validation, and post-processing.
-   `mendel-development-middleware`: Dev middleware that boots the pipeline client and serves bundles on demand.
-   `mendel-middleware`: Production middleware that serves manifest-backed JS/CSS bundles and SSR helpers.
-   `mendel-resolver`: Variation-aware resolver on top of Node/browser resolve.
-   `mendel-exec`: VM runner that executes the resolved module graph with variation-aware `require`.
-   `mendel-loader`: SSR loader that builds a variation map and returns a Mendel-aware resolver.
-   `mendel-deps`: Dependency parser and resolver for JS and CSS. Produces normalized dependency graphs.

## Pipeline plugins

-   `mendel-transform-babel`: Babel transform wrapper with project-aware plugin/preset resolution.
-   `mendel-transform-buble`: Bublé transform wrapper.
-   `mendel-transform-inline-env`: Inlines `process.env` references.
-   `mendel-transform-istanbul`: Adds Istanbul instrumentation.
-   `mendel-transform-less`: Compiles LESS to CSS.
-   `mendel-transform-uglify`: Minifies JS and preserves sourcemaps.
-   `mendel-parser-json`: Turns JSON into JS modules.
-   `mendel-requirify`: Browserify transform that rewrites variation requires into resolved files.
-   `mendel-treenherit`: Browserify transform that resolves module inheritance across variation directories.

## Generators

-   `mendel-generator-extract`: Splits a bundle into an extracted bundle based on globbed entry paths.
-   `mendel-generator-node-modules`: Pulls `node_modules` into a separate bundle.
-   `mendel-generator-prune`: Removes dangling deps and rewrites exposed IDs across bundle groups.

## Outlets

-   `mendel-outlet-browser-pack`: Serializes bundle entries into browser-pack output or file output.
-   `mendel-outlet-css`: Concatenates CSS entries, applies PostCSS, and writes sourcemaps or returns CSS.
-   `mendel-outlet-manifest`: Writes bundle manifests, with optional envify and uglify passes.
-   `mendel-outlet-server-side-render`: Writes SSR-ready files to disk and rewrites `require` calls for Node execution.

## Manifest tools

-   `mendel-manifest-extract-bundles`: Removes shared modules between manifests and repairs exposed deps.
-   `mendel-manifest-uglify`: Minifies manifest source before writeout.

## Test and integration helpers

-   `karma-mendel`: Karma plugin for Mendel projects.
-   `mendel-mocha-runner`: Mocha integration runner.

## Support packages

-   `mendel-development` exports many files directly, not a single root `index.js`.
-   `mendel-pipeline` also exposes internal clients, registry, cache, daemon, and step modules under `src/`.
-   `mendel-core` exposes tree walker, hash walker, serialiser, deserialiser, and variation walker modules.

## Examples

-   `examples/planout-example`: Mendel 1.x example app.
-   `examples/full-example`: Mendel 2.x example app.
