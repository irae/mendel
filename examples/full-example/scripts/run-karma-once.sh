#!/usr/bin/env bash
# Single-run karma for full-example.
# Callers set MENDEL_IPC (package.json uses .mendelipc-test-offline).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$ROOT/node_modules/.bin:$ROOT/../../node_modules/.bin:$PATH"

if [[ -z "${CHROME_BIN:-}" ]]; then
  if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
    export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  elif command -v google-chrome >/dev/null 2>&1; then
    export CHROME_BIN="$(command -v google-chrome)"
  elif command -v chromium >/dev/null 2>&1; then
    export CHROME_BIN="$(command -v chromium)"
  fi
fi

: "${MENDEL_IPC:=.mendelipc-test-offline}"
export MENDEL_IPC
rm -f "$MENDEL_IPC"

mendel --watch &
builderPid=$!

cleanup() {
  kill -s INT "$builderPid" 2>/dev/null || true
  wait "$builderPid" 2>/dev/null || true
  rm -f "$MENDEL_IPC"
}
trap cleanup EXIT

bash ../../scripts/wait-for-mendel-socket.sh

karma start test/karma.conf.js --single-run
testExited=$?
exit $testExited
