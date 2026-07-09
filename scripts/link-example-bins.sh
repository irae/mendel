#!/usr/bin/env bash
# Point examples/full-example/node_modules/.bin at the monorepo root .bin.
# Needed because root .npmrc uses a hoisted node_modules: CLIs (nf, karma, …)
# land at the repo root, while `pnpm run` only puts the package-local .bin on PATH.
#
# pnpm often recreates a real package .bin *after* root postinstall, wiping a
# symlink created too early. Call this from postinstall *and* prestart (etc.).
#
#   bash scripts/link-example-bins.sh           # quiet if already correct
#   bash scripts/link-example-bins.sh --warn    # always print the risk notice
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="${ROOT}/examples/full-example"
ROOT_BIN="${ROOT}/node_modules/.bin"
EXAMPLE_NM="${EXAMPLE}/node_modules"
EXAMPLE_BIN="${EXAMPLE_NM}/.bin"
# Relative to examples/full-example/node_modules/ (parent of the .bin link)
REL_TARGET="../../../node_modules/.bin"

always_warn=0
for arg in "$@"; do
  case "${arg}" in
    --warn | -w) always_warn=1 ;;
  esac
done

warn() {
  printf '%s\n' "$@" >&2
}

print_risk_notice() {
  warn ""
  warn "[mendel] WARN: examples/full-example/node_modules/.bin -> ${REL_TARGET}"
  warn "[mendel]   Hoisted monorepo layout: CLI bins live at the repo root. This symlink"
  warn "[mendel]   makes \`pnpm run\` in full-example find nf/karma/mendel/nodemon."
  warn "[mendel]   Risk: pnpm install may replace .bin with a real directory; prestart"
  warn "[mendel]   re-applies this link. Manual: pnpm run link:example-bins"
  warn ""
}

if [[ ! -d "${ROOT_BIN}" ]]; then
  warn "[mendel] link-example-bins: skip (no ${ROOT_BIN} yet)"
  exit 0
fi

if [[ ! -d "${EXAMPLE}" ]]; then
  warn "[mendel] link-example-bins: skip (no full-example directory)"
  exit 0
fi

if [[ ! -d "${EXAMPLE_NM}" ]]; then
  mkdir -p "${EXAMPLE_NM}"
fi

needs_link=1
if [[ -L "${EXAMPLE_BIN}" ]]; then
  current="$(readlink "${EXAMPLE_BIN}" || true)"
  if [[ "${current}" == "${REL_TARGET}" ]] && [[ -e "${EXAMPLE_BIN}/nf" || -e "${ROOT_BIN}/nf" ]]; then
    needs_link=0
  fi
fi

if [[ "${needs_link}" -eq 1 ]]; then
  rm -rf "${EXAMPLE_BIN}"
  ln -sfn "${REL_TARGET}" "${EXAMPLE_BIN}"
  warn "[mendel] link-example-bins: linked package .bin -> monorepo root .bin"
  print_risk_notice
elif [[ "${always_warn}" -eq 1 ]]; then
  print_risk_notice
fi
