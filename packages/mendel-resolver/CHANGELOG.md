# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.2.0](https://github.com/irae/mendel/compare/v4.1.1...v4.2.0) (2026-08-16)

### Bug Fixes

- **mendel-pipeline:** keep normalizedId intact for a bare variation-dir id ([9fd67b6](https://github.com/irae/mendel/commit/9fd67b6e7931f462d22884ca56a001fe88e4f1ce))
- **mendel-resolver:** drop phantom keys when a declared path fails to resolve ([8083ab2](https://github.com/irae/mendel/commit/8083ab2e30af28f52ece45ac0472fd8063e7972f))
- **mendel-resolver:** drop stale package scopes when the deps cache clears ([cffb13b](https://github.com/irae/mendel/commit/cffb13bbee0b547ee985385048fa7249c405f554))
- **mendel-resolver:** honor the exports.umd condition for the browser runtime ([7eaf29f](https://github.com/irae/mendel/commit/7eaf29f13f93779613c56eb8b71f0f2b6e11a62d))
- **mendel-resolver:** key the resolution cache by basedir, not bare name ([97a9ddc](https://github.com/irae/mendel/commit/97a9ddc80030fe9589da8cb8476423a5dad1100e))
- **mendel-resolver:** make resolution output independent of process.cwd ([d9e0fef](https://github.com/irae/mendel/commit/d9e0fef844a92672590fb6cfa585e8dd5c3aab51))
- **mendel-resolver:** reject .. and node_modules segments in subpaths and pattern matches ([28102ff](https://github.com/irae/mendel/commit/28102ff55ecbd6ef02720615c6c5508bf4c433f5))
- **mendel-resolver:** resolve files that exist only in a variation, not in base ([c05c156](https://github.com/irae/mendel/commit/c05c156163650b5d9e3cec2cd2192f022624b647))
- **mendel-resolver:** stop dropping browser runtime on umd/unpkg fallback ([5392028](https://github.com/irae/mendel/commit/539202808c873d62f7736749f1a8e6da958ff18a))
- **mendel-resolver:** support the package.json imports field ([fccc6d0](https://github.com/irae/mendel/commit/fccc6d053ea8cb4b6808f889657ba4d2ee0b2068))

### Features

- **mendel-resolver:** resolve packages through conditional exports ([2143531](https://github.com/irae/mendel/commit/2143531082b68cd625a2bf257d12fea198d932e1))

## [4.1.1](https://github.com/irae/mendel/compare/v4.1.0...v4.1.1) (2026-07-09)

**Note:** Version bump only for package mendel-resolver

# [4.1.0](https://github.com/irae/mendel/compare/v4.0.0...v4.1.0) (2026-07-09)

### Bug Fixes

- support dual-package CommonJS .cjs (and .mjs) modules ([6623f23](https://github.com/irae/mendel/commit/6623f23581a851ddf75564a7cc6996e068609756))
