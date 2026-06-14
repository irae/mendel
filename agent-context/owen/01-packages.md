# Package Catalog

## Runtime and build core

-   `mendel-config`: config loader and validator.
-   `mendel-core`: manifest-to-tree resolver for production requests.
-   `mendel-pipeline`: daemon/client build pipeline.
-   `mendel-middleware`: hash-route request middleware.
-   `mendel-development-middleware`: variation-route request middleware.
-   `mendel-development`: shared development helpers.
-   `mendel-resolver`: variation-aware module resolver.
-   `mendel-exec`: execute source through the registry.
-   `mendel-deps`: parse imports and resolve them.
-   `mendel-loader`: browserify loader wrapper.
-   `mendel-requirify`: require shim for browserify-style bundling.

## Generators

-   `mendel-generator-extract`: split a bundle into extracted and source bundles.
-   `mendel-generator-node-modules`: pull node_modules into a separate bundle.
-   `mendel-generator-prune`: remove dead deps and remap exposed ids across bundle groups.

## Outlets

-   `mendel-outlet-browser-pack`: emit browser-pack JS.
-   `mendel-outlet-css`: emit CSS plus source maps.
-   `mendel-outlet-manifest`: emit manifests with optional envify and uglify.
-   `mendel-outlet-server-side-render`: emit SSR-ready output.

## Transforms and parsers

-   `mendel-transform-babel`: Babel source transform.
-   `mendel-transform-buble`: Bublé source transform.
-   `mendel-transform-inline-env`: inline environment variables.
-   `mendel-transform-istanbul`: instrument coverage.
-   `mendel-transform-less`: compile LESS to CSS.
-   `mendel-transform-uglify`: minify source.
-   `mendel-transform-buble`, `mendel-transform-babel`, `mendel-transform-inline-env`, `mendel-transform-istanbul`, `mendel-transform-less`, and `mendel-transform-uglify` are source transforms, not bundle orchestrators.
-   `mendel-parser-json`: JSON parser plugin.

## Manifest and tree helpers

-   `mendel-manifest-extract-bundles`: post-process manifests by splitting bundle outputs.
-   `mendel-manifest-uglify`: compact manifest data.
-   `mendel-treenherit`: resolve directory inheritance for variation trees.

## Development and test tooling

-   `mendel-mocha-runner`: run mocha through Mendel’s registry.
-   `karma-mendel`: integrate Mendel with Karma.
