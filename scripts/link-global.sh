#!/usr/bin/env bash
# Register every packages/* package as a global pnpm link.
# Run from the monorepo root: pnpm run link:global
#
# Walk packages/* directly (not only via lerna). Some packages need a second
# pass once their monorepo siblings are already in the global store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

passes="${1:-3}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required" >&2
  exit 1
fi

link_all() {
  local dir name
  for dir in packages/*/; do
    [[ -f "${dir}package.json" ]] || continue
    name="$(node -p "require('./${dir}package.json').name" 2>/dev/null || true)"
    [[ -n "${name}" ]] || continue
    echo "  link --global ${name}"
    (cd "${dir}" && pnpm link --global)
  done
}

echo "Linking Mendel packages into the global pnpm store (${passes} pass(es))..."
for ((i = 1; i <= passes; i++)); do
  echo "== pass ${i}/${passes} =="
  link_all
done

echo
echo "Global Mendel packages (pnpm list -g --depth 0):"
pnpm list -g --depth 0 2>/dev/null | grep -E 'mendel-|karma-mendel' || true
echo
echo "Next: in your app, attach packages from this monorepo:"
echo "  bash ${ROOT}/scripts/link-into-project.sh"
echo "Full procedure: DEVELOPMENT.md → \"Linking a consumer project\"."
