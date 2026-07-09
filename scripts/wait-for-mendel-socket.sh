#!/usr/bin/env bash
# Block until the Mendel daemon IPC path exists (default: .mendelipc).
# Use before app servers / karma so they do not race an empty socket.
#
#   MENDEL_IPC=.mendelipc-test bash scripts/wait-for-mendel-socket.sh
#   bash scripts/wait-for-mendel-socket.sh && nodemon src/server/index.js
#
# Env:
#   MENDEL_IPC   socket path (default .mendelipc)
#   MENDEL_WAIT_SECONDS  max wait (default 60)
set -euo pipefail

socket="${MENDEL_IPC:-.mendelipc}"
max_seconds="${MENDEL_WAIT_SECONDS:-60}"
# 0.25s steps
max_steps=$((max_seconds * 4))
i=0

if [[ -e "${socket}" ]]; then
  exit 0
fi

echo "[mendel] waiting for builder socket ${socket} (up to ${max_seconds}s)..." >&2

while [[ "${i}" -lt "${max_steps}" ]]; do
  if [[ -e "${socket}" ]]; then
    echo "[mendel] builder socket ready: ${socket}" >&2
    exit 0
  fi
  sleep 0.25
  i=$((i + 1))
done

echo "[mendel] timed out waiting for builder socket ${socket}" >&2
echo "[mendel] start the daemon first (e.g. pnpm run builder) or raise MENDEL_WAIT_SECONDS" >&2
exit 1
