#!/usr/bin/env bash
# From a consumer project, point every installed mendel-* / karma-mendel
# dependency at this Mendel monorepo via `pnpm link <dir>`.
#
# Does NOT use `pnpm link --global`. pnpm 10 often fails that path with:
#   Symlink path is the same as the target path (.../pnpm/global/.../pkg)
# when packages are already partially linked or interdependent.
#
# Usage (cwd = consumer app that depends on Mendel):
#   bash /path/to/mendel/scripts/link-into-project.sh
#   bash /path/to/mendel/scripts/link-into-project.sh /other/mendel/checkout
#
# Optional: MENDEL_ROOT=/path/to/mendel (overrides default = monorepo of this script)
set -uo pipefail

if [[ ! -d node_modules ]]; then
  echo "Run this from a project that already has node_modules (pnpm install first)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MENDEL_ROOT="${1:-${MENDEL_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}}"
PACKAGES_DIR="${MENDEL_ROOT}/packages"

if [[ ! -d "${PACKAGES_DIR}" ]]; then
  echo "Mendel packages dir not found: ${PACKAGES_DIR}" >&2
  echo "Pass the monorepo root: bash $0 /path/to/mendel" >&2
  exit 1
fi

# Direct children only. Prefer BSD find -d 1 (macOS); fall back to GNU -maxdepth.
list_mendel_pkgs() {
  if find node_modules -d 1 \( -name 'mendel-*' -o -name 'karma-mendel' \) >/dev/null 2>&1; then
    find node_modules -d 1 \( -name 'mendel-*' -o -name 'karma-mendel' \) 2>/dev/null
  else
    find node_modules -maxdepth 1 \( -name 'mendel-*' -o -name 'karma-mendel' \) 2>/dev/null
  fi | sed 's|^node_modules/||' | sort -u
}

real_path() {
  (cd "$1" 2>/dev/null && pwd -P) || true
}

pkgs="$(list_mendel_pkgs)"
if [[ -z "${pkgs}" ]]; then
  echo "No mendel-* or karma-mendel packages found under ./node_modules" >&2
  exit 1
fi

count="$(printf '%s\n' "${pkgs}" | wc -l | tr -d ' ')"
echo "Mendel monorepo: ${MENDEL_ROOT}"
echo "Linking up to ${count} package(s) into $(pwd)"
echo

failures=0
# IFS= read avoids subshell issues from pipelines when we use process substitution
while IFS= read -r pkg; do
  [[ -z "${pkg}" ]] && continue
  src="${PACKAGES_DIR}/${pkg}"
  if [[ ! -d "${src}" ]]; then
    echo "  skip ${pkg} (no ${src})"
    continue
  fi

  target_real="$(real_path "${src}")"
  current_real=""
  if [[ -e "node_modules/${pkg}" ]]; then
    current_real="$(real_path "node_modules/${pkg}")"
  fi
  if [[ -n "${current_real}" && "${current_real}" == "${target_real}" ]]; then
    echo "  already ${pkg} -> ${current_real}"
    continue
  fi

  echo "  pnpm link ${src}"
  if ! pnpm link "${src}"; then
    echo "    WARN: pnpm link failed for ${pkg}" >&2
    failures=$((failures + 1))
  fi
done <<EOF
${pkgs}
EOF

echo
echo "Spot-check (expect paths under ${PACKAGES_DIR}):"
for pkg in mendel-deps mendel-resolver mendel-pipeline mendel-config karma-mendel; do
  if [[ -e "node_modules/${pkg}" ]]; then
    ls -la "node_modules/${pkg}" | sed 's/^/  /'
  fi
done

if [[ "${failures}" -gt 0 ]]; then
  echo
  echo "${failures} package(s) failed. If links are half-applied:" >&2
  echo "  pnpm install" >&2
  echo "  bash $0 ${MENDEL_ROOT}" >&2
  exit 1
fi

echo
echo "Done. Registry versions return after: pnpm install"
