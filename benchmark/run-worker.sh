#!/bin/bash
# Bootstraps one worktree and runs one worker on the issue-13 task.
# Usage: ./run-worker.sh <model> [harness] [bench] [thinking]
#   harness:  pi (the only harness; claude was retired 2026-09-01 — existing
#             claude-code rows stay in the results until replaced)
#   bench:    guided (default) | blind — see PLAN.md; the two tests keep
#             separate prompts, base commits, branch suffixes, and results files.
#   thinking: pi thinking level (off, minimal, low, medium, high, xhigh, max);
#             MANDATORY for pi runs (a level inherited from operator settings is
#             not comparable); appended to the slug so one model can have one
#             row per level.
# Every run gets a pinned environment: a benchmark-owned config dir with the
# frozen agents-global.md as the only global context file, no operator
# extensions/skills/plugins/hooks, and a check that no stray AGENTS.md or
# CLAUDE.md sits in a parent directory of the worktree.
# The pinned config is never a copy of the operator's: it is built fresh by
# ../choose-a-local-llm/tools/gen-pi-models.mjs --run-dir, for the one model
# under test only. The harness values of a run are measurements, never the
# operator's defaults (PLAN.md, and
# ../choose-a-local-llm/docs/methodology/mendel.md "Window and budget"). Pass
# them per run; they land in the pinned config only:
#   MENDEL_SITE_ID         the site's pi id to read the row from
#                          (docs/setups/<setup>/models.json), when it differs
#                          from the model argument (for example a run at a
#                          throwaway id like qwen3.8-27b-ista-q8-tb8192).
#                          Default the model argument.
#   MENDEL_CONTEXT_WINDOW  passed as --window to the generator: contextWindow
#                          for this model, from the run's newest creep. Empty
#                          keeps the site row's value.
#   MENDEL_KEEP_RECENT_TOKENS
#                          passed as --keep to the generator: forces
#                          compaction.keepRecentTokens. Empty derives it from
#                          the window curve (docs/methodology/mendel.md,
#                          "Window and budget"): 8192 under 65536, 16384 under
#                          131072, else pi's own default. A small window
#                          cannot hold pi's default keep budget plus a
#                          summary and still do work.
# pi runs go through run-pi-rpc.mjs (stateful RPC session with the fixed nudge
# policy, see PLAN.md); never through `pi -p`.
# Blocks until the worker finishes. Spawn several in parallel from separate
# shells; at most one run per plan provider at a time (a plan-provider
# run needs a quiet account — see PLAN.md "Plan accounting").
set -euo pipefail

model="${1:?usage: run-worker.sh <model> [harness] [bench]}"
harness="${2:-pi}"
bench="${3:-guided}"
thinking="${4:-}"
BENCH_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$BENCH_DIR/.." && pwd)"
case "$bench" in
    guided)
        BASE_COMMIT=benchmark-guided-base
        PROMPT="$BENCH_DIR/prompt-guided.txt"
        suffix="-guided-v3-issue-13"
        wtprefix="mendel-bench-guided-"
        ;;
    blind)
        BASE_COMMIT=benchmark-blind-base
        PROMPT="$BENCH_DIR/prompt-blind.txt"
        suffix="-issue-13"
        wtprefix="mendel-bench-"
        ;;
    *)
        echo "abort: unknown bench $bench" >&2
        exit 1
        ;;
esac
if [ "$harness" = "pi" ] && [ -z "$thinking" ]; then
    echo "abort: pi runs need an explicit thinking level (off|minimal|low|medium|high|xhigh|max)" >&2
    exit 1
fi
# Run evidence lives on the machine, never in a repo scratchpad: a
# scratchpad leaves with its worktree and takes the record with it.
# This path is provisional. The worker is being extracted as its own
# tool; adopt that tool's defaults when it lands and migrate the old
# locations. The override exists so the move is a setting.
RUNS="${MENDEL_RUNS_DIR:-$HOME/.local/share/mendel-benchmark/runs}"
CHOOSE_REPO="${CHOOSE_REPO:-$REPO/../choose-a-local-llm}"
LOOP_CHECK="${LOOP_CHECK:-$CHOOSE_REPO/benchmarks/loop-check.py}"
GEN_PI_MODELS="$CHOOSE_REPO/tools/gen-pi-models.mjs"
if [ ! -e "$GEN_PI_MODELS" ]; then
    echo "abort: no generator at $GEN_PI_MODELS; set CHOOSE_REPO" >&2
    exit 1
fi
PI_VERSION="$(pi --version 2>/dev/null)"
[ -n "$PI_VERSION" ] || PI_VERSION=unknown
slug="$(echo "$model" | tr '/:' '--')"
[ -n "$thinking" ] && slug="${slug}-${thinking}"
branch="${slug}${suffix}"
fslug="${slug}-${bench}"
wt="$REPO/../${wtprefix}${slug}"
mkdir -p "$RUNS"
echo "$slug: pi $PI_VERSION" >&2

if git -C "$REPO" show-ref --quiet "refs/heads/$branch"; then
    echo "abort: branch $branch exists" >&2
    exit 1
fi

# No stray context files above the worktree: they would layer into the run.
dir="$(cd "$(dirname "$wt")" && pwd)"
while [ "$dir" != "/" ]; do
    for f in AGENTS.md AGENTS.override.md CLAUDE.md; do
        if [ -e "$dir/$f" ]; then
            echo "abort: $dir/$f would leak into the run; move it or run from elsewhere" >&2
            exit 1
        fi
    done
    dir="$(dirname "$dir")"
done

if [ -e "$wt" ]; then
    echo "abort: $wt already exists; it is a previous run's evidence. Move it or use a suffix." >&2
    exit 1
fi
git -C "$REPO" worktree add -b "$branch" "$wt" "$BASE_COMMIT"
(cd "$wt" && pnpm install > "$RUNS/$fslug-install.log" 2>&1)
echo "$slug: worktree ready at $wt, starting $harness" >&2

# Plan accounting: probe the subscription windows before and after (see PLAN.md).
case "$harness:$model" in
    pi:openai-codex/*|pi:gpt-5.6-*) plan_provider=openai-codex ;;
    pi:xai/*|pi:grok-*) plan_provider=xai ;;
    *) plan_provider=none ;;
esac
if ! node "$BENCH_DIR/probe-plan.mjs" "$plan_provider" --out "$RUNS/$fslug-plan-before.json" > /dev/null; then
    echo "abort: plan probe failed for $plan_provider — no baseline, the run would not be accountable" >&2
    exit 1
fi

# Pinned config dir, one per run, on the machine and never versioned:
# only credentials, model config, and the frozen global instructions get
# in. It is the only record of the sampling the run actually used, so it
# is kept, never deleted.
build_pi_agent_dir() {
    local d="${MENDEL_PI_CONFIG_DIR:-$HOME/.local/share/mendel-benchmark/pi-agent}/$fslug"
    [ -d "$d" ] && mv "$d" "$d-$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$d"
    local site_id="${MENDEL_SITE_ID:-$model}"
    local gen_args=(--run-dir "$d" --id "$site_id" --as "$model")
    [ -n "${MENDEL_CONTEXT_WINDOW:-}" ] && gen_args+=(--window "$MENDEL_CONTEXT_WINDOW")
    [ -n "${MENDEL_KEEP_RECENT_TOKENS:-}" ] && gen_args+=(--keep "$MENDEL_KEEP_RECENT_TOKENS")
    if ! ( cd "$CHOOSE_REPO" && node tools/gen-pi-models.mjs "${gen_args[@]}" >&2 ); then
        echo "abort: gen-pi-models.mjs failed for $site_id" >&2
        exit 1
    fi
    # auth.json and models-store.json still come from the operator's config:
    # they hold provider credentials and pi's own model-store bookkeeping,
    # neither of which the site data carries.
    for f in auth.json models-store.json; do
        [ -e "$HOME/.pi/agent/$f" ] && cp "$HOME/.pi/agent/$f" "$d/"
    done
    cp "$BENCH_DIR/agents-global.md" "$d/AGENTS.md"
    echo "$d"
}

# Repetition-loop verdict at run close: a flag beside the row, never a stop.
loop_verdict="unchecked"
loop_ratio=""
loop_kind=""
run_loop_check() {
    local log="$RUNS/$fslug-session.jsonl"
    if [ ! -e "$LOOP_CHECK" ]; then
        echo "warning: no loop-check.py at $LOOP_CHECK; set LOOP_CHECK" >&2
        return
    fi
    if [ ! -e "$log" ]; then
        echo "warning: no session log at $log; loop verdict skipped" >&2
        return
    fi
    python3 "$LOOP_CHECK" "$log" > "$RUNS/$fslug-loop.txt" 2>&1 || true
    read -r loop_kind loop_ratio loop_verdict <<< "$(awk '
        /distinct-shape ratio=/ {
            for (i = 1; i <= NF; i++)
                if ($i ~ /^ratio=/) r = substr($i, 7)
            if (best == "" || r + 0 < best + 0) { best = r; k = $1; v = $NF }
        }
        END { if (best != "") print k, best, v }
    ' "$RUNS/$fslug-loop.txt")"
    case "$loop_kind" in
        thinking_delta) loop_kind=thinking ;;
        text_delta) loop_kind=text ;;
        toolcall_delta) loop_kind="tool call" ;;
    esac
    if [ -z "$loop_verdict" ]; then
        loop_verdict="unreadable"
    fi
    echo "$slug: loop verdict $loop_verdict, worst ratio ${loop_ratio:-none} on ${loop_kind:-none}" >&2
}

cd "$wt"
start=$(date -u +%FT%TZ)
case "$harness" in
    claude)
        echo "abort: the claude harness is retired (2026-09-01); run models through pi" >&2
        exit 1
        ;;
    pi)
        agentdir="$(build_pi_agent_dir)"
        PI_CODING_AGENT_DIR="$agentdir" \
        node "$BENCH_DIR/run-pi-rpc.mjs" --model "$model" --prompt "$PROMPT" \
            --out "$RUNS/$fslug" --cwd "$wt" --thinking "$thinking" \
            2> "$RUNS/$fslug-runner.log"
        ;;
    *)
        echo "abort: unknown harness $harness" >&2
        exit 1
        ;;
esac
end=$(date -u +%FT%TZ)
if [ -e "$RUNS/$fslug-meta.json" ]; then
    PI_VERSION="$PI_VERSION" python3 - "$RUNS/$fslug-meta.json" <<'PYEOF'
import json
import os
import sys

path = sys.argv[1]
meta = json.load(open(path))
meta['pi_version'] = os.environ['PI_VERSION']
json.dump(meta, open(path, 'w'), indent=2)
PYEOF
fi
run_loop_check
node "$BENCH_DIR/probe-plan.mjs" "$plan_provider" --out "$RUNS/$fslug-plan-after.json" > /dev/null \
    || echo "warning: plan probe after the run failed; record the plan share by hand" >&2
pkill -f "$wt" 2>/dev/null || true
# The model's uncommitted work is evidence too: the worktree is removed later.
git -C "$wt" add --all --intent-to-add
git -C "$wt" diff HEAD --binary > "$RUNS/$fslug-uncommitted.patch"
[ -s "$RUNS/$fslug-uncommitted.patch" ] || rm -f "$RUNS/$fslug-uncommitted.patch"
printf '{"model":"%s","harness":"%s","bench":"%s","thinking":"%s","plan_provider":"%s","branch":"%s","base_commit":"%s","start":"%s","end":"%s","pinned_env":"agents-global v1.0","loop_flag":"%s","loop_ratio":"%s","loop_kind":"%s"}\n' \
    "$model" "$harness" "$bench" "$thinking" "$plan_provider" "$branch" "$(git -C "$REPO" rev-parse --short "$BASE_COMMIT")" "$start" "$end" "$loop_verdict" "$loop_ratio" "$loop_kind" > "$RUNS/$fslug-worker.json"
echo "$slug: done" >&2
