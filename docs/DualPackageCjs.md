# Dual packages and `.cjs`

Some npm packages ship dual ESM/CJS builds under `"type": "module"`:

```json
{
    "type": "module",
    "main": "./dist/index.cjs",
    "module": "./dist/index.js"
}
```

Mendel resolves browser/main to the `.cjs` file (browser-pack expects CommonJS).

`mendel-deps` must treat `.cjs` (and `.mjs`) as JavaScript so `require()` calls become real deps entries. If deps stay empty, production and development vendor bundles still contain the source, but browser-pack cannot remap `require("react")` to Mendel's module id, and the packed module fails at runtime (`Cannot read properties of null (reading 'useState')`).

Regression coverage:

-   `packages/mendel-deps/test/cjs-support.js`
-   `packages/mendel-resolver/test/fixtures/dual-cjs/`
-   `packages/mendel-pipeline/test/dual-package-cjs.js`
-   `examples/full-example` (`react-use-measure` via `MeasuredBox`)
