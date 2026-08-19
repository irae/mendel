# prod-startup

A production app after `npm install --production` / `pnpm prune --prod`.

`.mendelrc` names transform, generator, and outlet plugins that are not
installed. `built/` already holds a manifest (named to stay out of the
root `build/` gitignore). Production middleware must
start from that tree. Build-time `devConfig` must still fail when the
transform package is missing.

Used by `packages/mendel-middleware/test/prod-startup.js`.
