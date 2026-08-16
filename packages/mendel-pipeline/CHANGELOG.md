# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.2.0](https://github.com/irae/mendel/compare/v4.1.1...v4.2.0) (2026-08-16)

### Bug Fixes

- **error-bundle:** guard console output from duplicate reporting ([a4bdda7](https://github.com/irae/mendel/commit/a4bdda78e5e5883beedae9f432187ef67e7201b4))
- **karma-mendel:** stop running tests against an errored build ([6d386b1](https://github.com/irae/mendel/commit/6d386b1581b8894fe76f135fb94ad1540c4284fe))
- **mendel-deps:** surface a JS file's own parse failure as an entry error ([5583570](https://github.com/irae/mendel/commit/5583570984ce0ea6933718d0f063e7bedd230f0b))
- **mendel-pipeline:** daemon stays up and answers errors instead of hanging or crashing ([b26087e](https://github.com/irae/mendel/commit/b26087e6037b3f9559f971c4875f43691de98714))
- **mendel-pipeline:** enforce parser coverage on main-runtime SSR walks too ([71500ff](https://github.com/irae/mendel/commit/71500ff2e2fde9132aca1ea0a5131eca5f6f02e1))
- **mendel-pipeline:** fail loudly when a bundle's entries resolve to nothing ([db6c81b](https://github.com/irae/mendel/commit/db6c81b4fe8b615d7138bd6922bb1c28a1783c20))
- **mendel-pipeline:** keep normalizedId intact for a bare variation-dir id ([9fd67b6](https://github.com/irae/mendel/commit/9fd67b6e7931f462d22884ca56a001fe88e4f1ce))
- **mendel-pipeline:** keep the process shim's normalizedId when node: aliases share its file ([7a2b310](https://github.com/irae/mendel/commit/7a2b3101f3a5068de79de798697356ea064b44cd))
- **mendel-pipeline:** prevent duplicate error-page rendering on multiple JS bundle errors ([7b6580a](https://github.com/irae/mendel/commit/7b6580a8a6057b8226a0f209659c5cf4ddd432fe))
- **mendel-pipeline:** render error bundle code frames instead of leaking raw ANSI codes ([87e68ba](https://github.com/irae/mendel/commit/87e68ba9928d31e222e1b1312d2d99fd0977b23c))
- **mendel-pipeline:** serve browser-field-mapped node modules consistently in graph walks ([d0b493f](https://github.com/irae/mendel/commit/d0b493f130f4789ba823c6b0350772681641641a))
- **mendel-pipeline:** share package identity across environment caches ([ba074de](https://github.com/irae/mendel/commit/ba074debec58650e7c72d4a03e70883bbb84a66e))
- **mendel-pipeline:** stop a narrow terminal from flipping a successful build's exit code ([2adb1fe](https://github.com/irae/mendel/commit/2adb1fe00a7168e5fc857fc7808139207f4aff4d))
- **mendel-pipeline:** stop extended colour sequences repainting the error page ([cf90cb2](https://github.com/irae/mendel/commit/cf90cb28d431b4038e55da1c607eadd43a186033))
- **mendel-pipeline:** stop ignore patterns matching project ancestor directories ([9662772](https://github.com/irae/mendel/commit/9662772316d491c3128e6af838c49240f748c660))
- **mendel-pipeline:** stop the client from staying desynced after a file is deleted ([c773c87](https://github.com/irae/mendel/commit/c773c87de3e4512bf56a74bff34271645a38ed6f))
- **mendel-pipeline:** throw clear error when build() is called before run() ([d72614e](https://github.com/irae/mendel/commit/d72614e03c9b1a51ecd241de4b26ce50d7e9ae8b))
- **mendel-pipeline:** waiter barrier re-evaluates on final removals ([0716aef](https://github.com/irae/mendel/commit/0716aef64556cf661d1365bf8420b3b299fca945))
- **mendel-resolver:** drop stale package scopes when the deps cache clears ([cffb13b](https://github.com/irae/mendel/commit/cffb13bbee0b547ee985385048fa7249c405f554))
- **mendel-resolver:** resolve files that exist only in a variation, not in base ([c05c156](https://github.com/irae/mendel/commit/c05c156163650b5d9e3cec2cd2192f022624b647))
- **pipeline:** apply negated bundle entry globs ([1f89017](https://github.com/irae/mendel/commit/1f8901797c7ab103f4db51a76ede7ed5cc709b37))
- **pipeline:** keep package.json dual-deps in browser graph walks ([b781a11](https://github.com/irae/mendel/commit/b781a116483e9a81d327046291cf7e33ec2f1922))
- **pipeline:** watch files when the project sits under a dot directory ([07a054b](https://github.com/irae/mendel/commit/07a054b30a21c9bf33fc1cb8acce85a665fa5751))

### Features

- **mendel-pipeline:** error loudly in dev when a require has no configured parser ([89ec2d6](https://github.com/irae/mendel/commit/89ec2d6ed35ba720a0c1ddc571e694a1f14930c0))
- **pipeline:** use node-stdlib-browser for default Node core shims ([6698a52](https://github.com/irae/mendel/commit/6698a526fc76d54cb4415b272b2958a2753a8002))

### Performance Improvements

- **mendel-pipeline:** make deliverableSize an O(1) incremental count ([15c2c0e](https://github.com/irae/mendel/commit/15c2c0ef60452811484707ad852f2643adeccb16))

## [4.1.1](https://github.com/irae/mendel/compare/v4.1.0...v4.1.1) (2026-07-09)

**Note:** Version bump only for package mendel-pipeline

# [4.1.0](https://github.com/irae/mendel/compare/v4.0.0...v4.1.0) (2026-07-09)

### Bug Fixes

- support dual-package CommonJS .cjs (and .mjs) modules ([6623f23](https://github.com/irae/mendel/commit/6623f23581a851ddf75564a7cc6996e068609756))

# [4.0.0-alpha.4](https://github.com/irae/mendel/compare/v4.0.0-alpha.3...v4.0.0-alpha.4) (2024-04-30)

### Bug Fixes

- mendel-deps update parser ([5374b87](https://github.com/irae/mendel/commit/5374b87917156ae86ef539d5cb7449fc4bf9f315))
