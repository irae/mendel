# Mendel user path

## What Mendel is for

Mendel helps teams ship A/B tests, multivariate tests, multilayer tests, white-label variants, and environment-specific front-end code as separate JavaScript bundles. It fits teams that want to keep variation code disposable and keep the base app clean.

## What it removes

-   Inline experiment conditionals in application code.
-   Shipping inactive variation code to the client.
-   Runtime variation lookup from the file system or network in production.
-   Bundle URLs that expose variation names.

## What you must supply

-   A base app.
-   Variation folders with the same relative file shape as the base files you want to override.
-   A configuration file, `package.json` config, or programmatic options.
-   Some separate tool for assigning users to variations.
-   Some separate tool for measuring outcomes.

## Vocabulary

-   `base`: the default code path.
-   `variation`: the experiment or bucket.
-   `bundle`: the output for a named part of the app.
-   `layer`: a grouping used for multilayer setups.
-   `normalizedId`: the shared path identity used for matching files across variations.
-   `manifest`: the precompiled description Mendel uses at runtime.
-   `resolver`: the server-side module lookup path for the same variation set.

## Smallest credible first use

1. Put the app in a base source tree.
2. Add one variation folder that mirrors only the files you want to change.
3. Declare the variation in `.mendelrc` or `package.json`.
4. Run a development example with `npm run development`.
5. Load the app, then force a variation with query params or a cookie-based assignment layer.

## Path from idea to cleanup

### 1. Start with an experiment idea

You decide which user-visible file should differ. Mendel expects you to express the difference as file overrides, not `if` statements.

### 2. Local development

In development, Mendel serves bundles on demand, enables source maps, and shows file saves quickly. The docs say the first load is slow, then changes propagate almost immediately. `mendel-development-middleware` also lets the app continue on to SSR or other request handling when the request is not a bundle route.

### 3. Bundle creation

Mendel builds one bundle per variation or bundle id. The docs and comments say it can also separate node modules, prune dangling files, and extract lazy bundles.

### 4. Serving and resolution

At runtime, Mendel resolves the active variation set, finds the right files by normalized id, and serves a bundle URL that uses a hash instead of variation names. `mendel-core` and `mendel-exec` are the pieces that recover the same tree for a variation set or hash.

### 5. Rollout

The docs support production bundles, hashed URLs, SSR per request, and cache-friendly bundle serving. The user-facing rollout step is to deploy the production build and let whatever assignment system you use pick the variation.

### 6. Cleanup

Mendel says variation code should be immediately disposable. The practical cleanup path is to remove the variation folder, remove its config entry, and rebuild. This is an inference from the docs, not an explicit workflow.
