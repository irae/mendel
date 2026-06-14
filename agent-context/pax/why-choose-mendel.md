# Why Choose Mendel

## Zero payload overhead — by construction

Most A/B testing systems send all variation code to the client and use JavaScript conditionals to select the active path at runtime. The user's browser downloads code for experiments they will never see. Mendel's architecture makes this impossible: each user receives a bundle assembled from only the files their variation requires. No alternative paths are present in the bundle, not even as dead code that a minifier might remove.

This is not a configuration option or an optimization you tune. It follows directly from the model: separate files produce separate bundles.

## CDN caching that actually works

Serving variation-specific bundles usually forces servers to set `Vary: Cookie` or to use personalized URLs that CDNs cannot cache effectively. Mendel avoids both.

Bundle URLs are hashes. The hash encodes the variation combination and the content of every file in the bundle. It contains no experiment names, no user identifiers, no cookies. Any user in the same variation combination gets the same URL. CDNs cache it without configuration. When you deploy a change that only touches one file in one variation, only the bundles that include that file get new hashes. Every other cached URL stays valid across the deployment.

## Variation disposal is a `rm -rf`

When an experiment ends, cleanup is a directory deletion. There is no code archaeology — no searching for `if (experimentName)` blocks scattered across dozens of files, no risk of leaving a dead conditional in place. The entire variation lives in one folder. Delete the folder; the variation is gone. Mendel will stop including it in builds automatically.

This was identified as the primary driver of technical debt in Yahoo's large applications before Mendel existed: experiment code that was never cleaned up because cleanup was too costly.

## Any file type, same model

Mendel's variation model is not specific to JavaScript. CSS, LESS, JSON configuration files, and any other file type follow the same folder-override pattern. You can A/B test your stylesheet, your i18n strings, or your icon set using exactly the same mechanism as your React components. Other build systems require separate approaches per file type; Mendel's model is uniform.

## Composable multi-file experiments with inheritance

A new feature might require changes across ten files. A sub-experiment on that feature might change only one. Variation inheritance lets you express this directly:

```yaml
variations:
    new_feature:
        - new_feature # 10 files
    new_feature_variant_b:
        - new_feature_b # 1 file (overrides the one different thing)
        - new_feature # inherits the other 9 files
```

No duplication. The inheritance chain is declared once, is explicit, and is the same for every file in the resolution — there is no per-file conditional ordering ambiguity.

## Independent experiment layers mean teams don't block each other

Without layers, all experiments must share 100% of users, and teams must negotiate allocation. With Mendel's multilayer support, the checkout team and the search team can each run independent experiments across their full user base simultaneously, without coordination overhead and without their experiments interfering with each other's measurements.

## Security by default

A/B testing systems that embed experiment names in URLs or compiled source let determined users infer what business hypotheses you are testing, download multiple bundles to compare them, or use browser tools to see conditional logic. Mendel's hashed bundle URLs reveal nothing. The compiled bundle for a variation contains no string references to the variation's name. In development mode, source maps expose mnemonic folder names for developer convenience; in production, that information is absent.

## Fast development cycles as a first-class concern

The design document commits to a specific target: file save to visible change in under 300 milliseconds, including server-side rendering. The daemon architecture supports this by holding transformed file caches. When a file changes, only that file's transforms re-run; the rest of the cache is valid. Development mode also supports variation override via query string or cookie without requiring any external configuration system, so a developer can see their new variation in the browser without a deployment.

## Proven at scale

Mendel's approach to variation management was in production use at Yahoo before Mendel itself was written. The framework codifies what worked across large teams and multi-year product lifespans. The filesystem folder model specifically addresses the failure modes that other approaches — git branches per experiment, code conditionals, runtime feature flags — exhibited at scale.
