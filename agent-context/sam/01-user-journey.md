# Mendel user path

## Product frame

Teams use Mendel to build and serve separate front-end bundles for A/B tests, multivariate tests, and multilayer tests. The same file-overlay model can support white-labeling, themes, settings, and environment variants.

Mendel targets teams that want disposable variation code, SSR alignment, and no client payload from inactive variations. This fit is an inference from the stated design goals.

## Product boundary

Mendel supplies file selection, bundle creation, server-side resolution, and variation-safe bundle URLs.

You must supply:

-   A base application.
-   Variation files and configuration.
-   A service or library that assigns each user to variations.
-   Analytics that connect assignments to outcomes.

## Pain removed

-   Experiment conditionals inside base application files.
-   Inactive variation code in a user's download.
-   File-system or network access during production resolution.
-   Variation names in production bundle URLs and compiled client code.

## Vocabulary

-   `base`: the default application files and experience.
-   `variation`: a named experiment, bucket, or contextual variant.
-   `variation chain`: an ordered list of folders used for inheritance.
-   `layer`: one independent experiment dimension in a multilayer setup.
-   `bundle`: a named client output such as the main app or vendor code.
-   `manifest`: precompiled file and dependency data used for production resolution.
-   `hash`: the opaque production identifier for one resolved dependency tree.
-   `resolver`: the server-side API that loads modules for the selected variations.
-   `normalizedId`: the shared file identity used to match base and variation entries. New-user docs can defer this term until conflict diagnosis.

## Smallest verified demo

The repository documents this runnable path for the PlanOut example:

1. Enter `examples/planout-example`.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npm run development`.
5. Open `localhost:3000`.
6. Use the documented `variations` query parameter to request a variation combination.

This example demonstrates Mendel 1.x and contains a TODO. A current adoption path from package install to production integration remains undocumented.

## Path from idea to cleanup

### 1. Choose the changed files

Start from the base tree. Copy only the files that the variation changes into a variation folder.

Keep each override at the same relative path and extension as its base counterpart. `docs/ManifestValidation.md` warns that paths such as `square.js` and `square/index.js` can resolve to different module ids and make the same base parent compile to different sources.

### 2. Configure the variation

Declare the variation and its ordered folder chain in `.mendelrc`, the `mendel` field in `package.json`, or programmatic options. Relative paths resolve from the directory that contains the selected file configuration.

### 3. Run the developer loop

Development mode compiles bundles on demand and enables source maps. The first request can take time; later saves should reach all bundle combinations with little delay.

Developers can select variations through query parameters, cookies, local configuration, or development-only variations. The docs state this as a design goal; the PlanOut example demonstrates query parameters and cookies.

### 4. Build production artifacts

Production mode requires a build before server startup. Source changes require another build and restart. Mendel expects transforms to produce the same output for the same source; timestamps or other changing transform output can fail manifest validation.

### 5. Resolve HTML and SSR

Your assignment system chooses the active variation list during the application request. Pass that same list to Mendel for server rendering and bundle URL generation so the server markup and client code match.

### 6. Serve bundles

Mendel resolves the variation list to dependencies and a deterministic hash. The browser, CDN, or proxy can request the bundle by hash without assignment cookies or a `Vary` header.

### 7. Roll out

Deploy the production build, then let the external assignment system control exposure. Mendel does not choose traffic percentages or record experiment outcomes.

### 8. Clean up

Project docs call variation code immediately disposable. They give no cleanup procedure. A likely cleanup path removes the variation folder and configuration entry, promotes winning changes to base when needed, rebuilds, and redeploys. Treat this sequence as inference.
