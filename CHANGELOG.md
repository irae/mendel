# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.2.0](https://github.com/irae/mendel/compare/v4.1.1...v4.2.0) (2026-08-16)

### Bug Fixes

- **.gitignore:** stop hiding the full-example jsdom test setup from Prettier ([ca9e508](https://github.com/irae/mendel/commit/ca9e508096907f9969630178e3fce579267dbbd8))
- **development:** upgrade tmp to a maintained release ([a0a1b1c](https://github.com/irae/mendel/commit/a0a1b1c283bc03c1a478ab2b1d4206c59aaf79f5))
- **error-bundle:** guard console output from duplicate reporting ([a4bdda7](https://github.com/irae/mendel/commit/a4bdda78e5e5883beedae9f432187ef67e7201b4))
- **karma-mendel:** define global in the karma page like the bundle prelude does ([470d9b2](https://github.com/irae/mendel/commit/470d9b240141b9e9acc11fe2b2d171f8251ea17d))
- **karma-mendel:** give the karma page a full process shim object ([41e64c8](https://github.com/irae/mendel/commit/41e64c8d3659fb75e6bc0aa8db7fbba121e7efa8))
- **karma-mendel:** protect preprocessor from crashes after the readiness gate ([a9d60e8](https://github.com/irae/mendel/commit/a9d60e80b16eedec67aa11345e23eafa0a9914c3))
- **karma-mendel:** protect preprocessor prologue with try/catch ([aa67ba3](https://github.com/irae/mendel/commit/aa67ba329c4ffc09712b5ded597e30a182e83d39))
- **karma-mendel:** recover from a build error instead of crashing the process ([4e2ee0c](https://github.com/irae/mendel/commit/4e2ee0c7e92a6a13a5a0e28e245358cf3ba683e6))
- **karma-mendel:** stop running tests against an errored build ([6d386b1](https://github.com/irae/mendel/commit/6d386b1581b8894fe76f135fb94ad1540c4284fe))
- **mendel-config,lint-staged:** tooling micro-fixes surfaced by agents ([7e09b50](https://github.com/irae/mendel/commit/7e09b507abbee304fc373ef0060d3b502133721a))
- **mendel-config:** correct gst validation check from .kind to .mode ([6e6934f](https://github.com/irae/mendel/commit/6e6934f6ec26a116d6f62858aded0e3bb9f52652))
- **mendel-config:** fail fast with an actionable error on missing plugins ([0d49575](https://github.com/irae/mendel/commit/0d495757540c1556bd29ffa5f25db48d23ebabec))
- **mendel-config:** keep shim paths above the project root as one spelling ([5b1c10c](https://github.com/irae/mendel/commit/5b1c10cdbe776ec8e25aa8d6f5c8e9e84c806233))
- **mendel-deps:** handle CSS [@import](https://github.com/import) with media query suffix ([03c0ab8](https://github.com/irae/mendel/commit/03c0ab883510439e02f5f9a642930efb6d7637f1))
- **mendel-deps:** stop crashing on a parse failure instead of recovering ([f225516](https://github.com/irae/mendel/commit/f22551689e493821646fcbe125f2c81c3c552808))
- **mendel-deps:** surface a JS file's own parse failure as an entry error ([5583570](https://github.com/irae/mendel/commit/5583570984ce0ea6933718d0f063e7bedd230f0b))
- **mendel-outlet-browser-pack:** interleave each mapped module with its own sourcemap ([073a1ae](https://github.com/irae/mendel/commit/073a1ae6c6bc550575a0ec8d664eb28ad37e08e1))
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
- **mendel-resolver:** drop phantom keys when a declared path fails to resolve ([8083ab2](https://github.com/irae/mendel/commit/8083ab2e30af28f52ece45ac0472fd8063e7972f))
- **mendel-resolver:** drop stale package scopes when the deps cache clears ([cffb13b](https://github.com/irae/mendel/commit/cffb13bbee0b547ee985385048fa7249c405f554))
- **mendel-resolver:** honor the exports.umd condition for the browser runtime ([7eaf29f](https://github.com/irae/mendel/commit/7eaf29f13f93779613c56eb8b71f0f2b6e11a62d))
- **mendel-resolver:** key the resolution cache by basedir, not bare name ([97a9ddc](https://github.com/irae/mendel/commit/97a9ddc80030fe9589da8cb8476423a5dad1100e))
- **mendel-resolver:** make resolution output independent of process.cwd ([d9e0fef](https://github.com/irae/mendel/commit/d9e0fef844a92672590fb6cfa585e8dd5c3aab51))
- **mendel-resolver:** reject .. and node_modules segments in subpaths and pattern matches ([28102ff](https://github.com/irae/mendel/commit/28102ff55ecbd6ef02720615c6c5508bf4c433f5))
- **mendel-resolver:** resolve files that exist only in a variation, not in base ([c05c156](https://github.com/irae/mendel/commit/c05c156163650b5d9e3cec2cd2192f022624b647))
- **mendel-resolver:** stop dropping browser runtime on umd/unpkg fallback ([5392028](https://github.com/irae/mendel/commit/539202808c873d62f7736749f1a8e6da958ff18a))
- **mendel-resolver:** support the package.json imports field ([fccc6d0](https://github.com/irae/mendel/commit/fccc6d053ea8cb4b6808f889657ba4d2ee0b2068))
- **mendel-transform-inline-env:** keep delete process.env.X valid after inlining ([92f9215](https://github.com/irae/mendel/commit/92f9215c4fae4a7dd58cdff2cf5767bad2b5c80c))
- **mendel-transform-uglify:** surface uglify-js failures instead of returning undefined source ([fce57b4](https://github.com/irae/mendel/commit/fce57b47f94d79c7ae054e9c1ef9141efd97ea47))
- **pipeline:** apply negated bundle entry globs ([1f89017](https://github.com/irae/mendel/commit/1f8901797c7ab103f4db51a76ede7ed5cc709b37))
- **pipeline:** keep package.json dual-deps in browser graph walks ([b781a11](https://github.com/irae/mendel/commit/b781a116483e9a81d327046291cf7e33ec2f1922))
- **pipeline:** watch files when the project sits under a dot directory ([07a054b](https://github.com/irae/mendel/commit/07a054b30a21c9bf33fc1cb8acce85a665fa5751))
- **requirify:** fix crash writing output on modern Node and add functional tests ([a938ece](https://github.com/irae/mendel/commit/a938ece2893b435740a7c996fef6803bb1f1c42a))
- **test:** restore root app-samples fixtures for legacy suite ([ce1b467](https://github.com/irae/mendel/commit/ce1b467840c055f01351bc1a4e9d55726e6b756a))
- **transform-less:** upgrade less to drop vulnerable image-size dependency ([4ea287f](https://github.com/irae/mendel/commit/4ea287ff44f1f107f099aeff373d249f0e9980e0))
- **treenherit:** upgrade async and adapt directory resolution callbacks ([f3c4d5e](https://github.com/irae/mendel/commit/f3c4d5e7de3a36ff6122f7118a4c666fdabdd274))

### Features

- **full-example:** page nav exercising third-party library packaging ([93068cb](https://github.com/irae/mendel/commit/93068cbd23f6645b734a310f44405d7414580c55))
- **mendel-parser-plaintext:** add plaintext-as-JS-string parser ([0c79b6e](https://github.com/irae/mendel/commit/0c79b6e5e674f76e07d348fd923014ee48736cf3))
- **mendel-pipeline:** error loudly in dev when a require has no configured parser ([89ec2d6](https://github.com/irae/mendel/commit/89ec2d6ed35ba720a0c1ddc571e694a1f14930c0))
- **mendel-resolver:** resolve packages through conditional exports ([2143531](https://github.com/irae/mendel/commit/2143531082b68cd625a2bf257d12fea198d932e1))
- **pipeline:** use node-stdlib-browser for default Node core shims ([6698a52](https://github.com/irae/mendel/commit/6698a526fc76d54cb4415b272b2958a2753a8002))

### Performance Improvements

- **mendel-pipeline:** make deliverableSize an O(1) incremental count ([15c2c0e](https://github.com/irae/mendel/commit/15c2c0ef60452811484707ad852f2643adeccb16))

urated per-release summaries: [RELEASE_NOTES.md](RELEASE_NOTES.md).

## [4.1.1](https://github.com/irae/mendel/compare/v4.1.0...v4.1.1) (2026-07-09)

**Note:** Version bump only for package mendel-monorepo

# [4.1.0](https://github.com/irae/mendel/compare/v4.0.0...v4.1.0) (2026-07-09)

### Bug Fixes

- **full-example:** reliable start under pnpm hoisting and foreman ([ce74e22](https://github.com/irae/mendel/commit/ce74e22afbd8d6b66c66b0748ccea698e0ebd4f1))
- support dual-package CommonJS .cjs (and .mjs) modules ([6623f23](https://github.com/irae/mendel/commit/6623f23581a851ddf75564a7cc6996e068609756))

### Features

- **full-example:** exercise react-use-measure dual package ([aeed980](https://github.com/irae/mendel/commit/aeed980c5d5660b0c5a4a0866576cf90ba6f8617))

# [4.0.0-alpha.4](https://github.com/irae/mendel/compare/v4.0.0-alpha.3...v4.0.0-alpha.4) (2024-04-30)

### Bug Fixes

- mendel-deps update parser ([5374b87](https://github.com/irae/mendel/commit/5374b87917156ae86ef539d5cb7449fc4bf9f315))
