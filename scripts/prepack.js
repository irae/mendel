// Shared prepack for every publishable package. Run from the package dir.
// 1. Refuse npm: it leaves workspace:^ ranges in the tarball (DEVELOPMENT.md).
// 2. Copy the monorepo RELEASE_NOTES.md into the package so the tarball
//    ships it (the per-package copy is gitignored; files whitelists it).
const fs = require('fs');
const path = require('path');

if (!/pnpm\//.test(process.env.npm_config_user_agent || '')) {
    throw new Error('pack/publish with pnpm only');
}

const notes = path.resolve(__dirname, '..', 'RELEASE_NOTES.md');
if (fs.existsSync(notes)) {
    fs.copyFileSync(notes, path.resolve(process.cwd(), 'RELEASE_NOTES.md'));
}
