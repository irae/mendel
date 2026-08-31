# Pi session logs

Raw pi session JSONLs for the pi runs that used a `../mendel-bench*` or
`../mendel-bench2*` worktree. Each file is the harness log copied from
`~/.pi/agent/sessions/`, with every absolute home path rewritten to `~`.
The rest of the file is verbatim.

A run that the harness restarted has two files, `-session-1` and `-session-2`.
Read them in order; together they are the one scored run.

| File                                                               | Bench  | Branch                                             | Session UUID                           | Start (UTC)      | Note                                                         |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------- | -------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `gpt-5.6-sol-issue-13-session.jsonl`                               | blind  | `gpt-5.6-sol-issue-13`                             | `01a04a22-be47-77ec-b1e2-a24617284fae` | 2026-08-28 20:49 |                                                              |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-session-1.jsonl`          | blind  | `mlx-community-Qwen3.8-27B-4bit-issue-13`          | `01a05449-0773-7869-a96c-4b584c8ef96d` | 2026-08-30 20:07 | before the mid-run restart                                   |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-session-2.jsonl`          | blind  | `mlx-community-Qwen3.8-27B-4bit-issue-13`          | `01a054bd-a5c3-7526-9b0a-3e5af3b2ce56` | 2026-08-30 22:15 | after the mid-run restart                                    |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-session-1.jsonl`    | blind  | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13`    | `01a053b4-6a8e-75b8-84b8-d6bfbdd822a8` | 2026-08-30 17:25 | first attempt, killed by the tool-call parser crash          |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-session-2.jsonl`    | blind  | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13`    | `01a053df-17c8-7ae5-ba76-a0df6aeae5ec` | 2026-08-30 18:12 | the scored attempt                                           |
| `qwen3.6-35b-a3b-issue-13-r2-session.jsonl`                        | guided | `qwen3.6-35b-a3b-issue-13-r2`                      | `01a055c6-4769-78d7-842a-a8cff7ce2591` | 2026-08-31 03:04 |                                                              |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-r2-session.jsonl`   | guided | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-r2` | `01a0561b-94aa-73ca-9ab6-4bc38e61e917` | 2026-08-31 04:37 |                                                              |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-r2-low-session-1.jsonl`   | guided | `mlx-community-Qwen3.8-27B-4bit-issue-13-r2-low`   | `01a056f8-1e8f-7040-9486-a3d567f7ee02` | 2026-08-31 08:38 | reasoning effort low                                         |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-r2-low-session-2.jsonl`   | guided | `mlx-community-Qwen3.8-27B-4bit-issue-13-r2-low`   | `01a05747-4350-77b2-bc04-c13960a97763` | 2026-08-31 10:04 | reasoning effort low, after the restart                      |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-r2-aborted-session.jsonl` | guided | none                                               | `01a055c0-c135-7a38-85d9-5db8573e0580` | 2026-08-31 02:58 | abandoned attempt at medium effort; no branch, no result row |

## Missing logs

The six older pi blind runs (`grok-4.6`, `gpt-5.6-luna`, `kimi-k3`,
`deepseek-v4-pro-0813`, `qwen3.6-35b-a3b`, `gemma-4-26b-a4b`) ran in the main
repo, before the bench worktrees existed. Their logs sit in
`~/.pi/agent/sessions/--Users-irae-code-mendel--/`, mixed with unrelated
coordinator work in the same directory. They are not in this directory yet.
