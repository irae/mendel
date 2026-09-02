# Pi session logs

Raw pi session JSONLs for every pi run in `results.json` and
`results-guided.json`. Each file is the harness log copied from
`~/.pi/agent/sessions/`, with every absolute home path rewritten to `~`. The
rest of each file is verbatim.

A run with two files (`-session-1`, `-session-2`) is still one run. Read the
files in order. The note column says what separates them.

## How each file was matched to its run

Every pi assistant message carries its own `model`, `usage`, and timestamp. For
each candidate session, count the assistant messages of the run's model, count
the `toolCall` blocks, and take the first-to-last timestamp span. Compare those
three numbers against the `telemetry` block of the run's row. Each blind run
below matches its row on `assistant_msgs` and `tool_calls` exactly.

## Blind runs

| File                                                            | Branch                                          | Session UUID                           | Start (UTC)      | Note                                                               |
| --------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `grok-4.6-issue-13-session.jsonl`                               | `grok-4.6-issue-13`                             | `01a03e60-9980-7d31-8eee-b7bce05dd89c` | 2026-08-26 14:01 |                                                                    |
| `luna-5.6-max-issue-13-session.jsonl`                           | `luna-5.6-max-issue-13`                         | `01a03ec2-6c9c-7ecf-ac07-6352ad578749` | 2026-08-26 15:48 |                                                                    |
| `kimi-k3-issue-13-session.jsonl`                                | `kimi-k3-issue-13`                              | `01a03fd2-e021-76e4-97f5-21b4cc9aad34` | 2026-08-26 20:46 |                                                                    |
| `deepseekv4-pro-0813-issue-13-session.jsonl`                    | `deepseekv4-pro-0813-issue-13`                  | `01a03e11-d982-78f1-96e8-5c1cd7ae398b` | 2026-08-26 12:35 |                                                                    |
| `qwen3.6-35b-a3b-issue-13-session-1.jsonl`                      | `qwen3.6-35b-a3b-issue-13`                      | `01a03adb-4cb2-7ac5-bb46-3f0583578759` | 2026-08-25 21:37 | false start, 7 minutes, not scored                                 |
| `qwen3.6-35b-a3b-issue-13-session-2.jsonl`                      | `qwen3.6-35b-a3b-issue-13`                      | `01a03ae2-3d8a-7243-8db1-88c0153ea4a9` | 2026-08-25 21:45 | the scored run                                                     |
| `gemma-4-26b-a4b-issue-13-session.jsonl`                        | `gemma-4-26b-a4b-issue-13`                      | `01a03ba6-9652-70f9-abb8-40682e380f83` | 2026-08-26 01:19 | **the scored run is lines 1-236 only**, see below                  |
| `gpt-5.6-sol-issue-13-session.jsonl`                            | `gpt-5.6-sol-issue-13`                          | `01a04a22-be47-77ec-b1e2-a24617284fae` | 2026-08-28 20:49 |                                                                    |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-session-1.jsonl` | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13` | `01a053b4-6a8e-75b8-84b8-d6bfbdd822a8` | 2026-08-30 17:25 | first attempt, killed by the tool-call parser crash                |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13-session-2.jsonl` | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-issue-13` | `01a053df-17c8-7ae5-ba76-a0df6aeae5ec` | 2026-08-30 18:12 | the scored attempt                                                 |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-session-1.jsonl`       | `mlx-community-Qwen3.8-27B-4bit-issue-13`       | `01a05449-0773-7869-a96c-4b584c8ef96d` | 2026-08-30 20:07 | before the mid-run restart                                         |
| `mlx-community-Qwen3.8-27B-4bit-issue-13-session-2.jsonl`       | `mlx-community-Qwen3.8-27B-4bit-issue-13`       | `01a054bd-a5c3-7526-9b0a-3e5af3b2ce56` | 2026-08-30 22:15 | after the mid-run restart                                          |
| `mlx-community-Qwen3.8-27B-4bit-low-issue-13-session.jsonl`     | `mlx-community-Qwen3.8-27B-4bit-low-issue-13`   | `01a05f81-f474-7b76-8647-33c364b53413` | 2026-09-02 00:25 | partial, tooling_budget_exhausted at 88% of the 26624-token window |

## Guided runs

| File                                                                   | Branch                                                 | Session UUID                           | Start (UTC)      | Note                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `qwen3.6-35b-a3b-guided-issue-13-session.jsonl`                        | `qwen3.6-35b-a3b-guided-issue-13`                      | `01a055c6-4769-78d7-842a-a8cff7ce2591` | 2026-08-31 03:04 |                                                              |
| `prism-ml-Ternary-Bonsai-27B-mlx-2bit-guided-issue-13-session.jsonl`   | `prism-ml-Ternary-Bonsai-27B-mlx-2bit-guided-issue-13` | `01a0561b-94aa-73ca-9ab6-4bc38e61e917` | 2026-08-31 04:37 |                                                              |
| `mlx-community-Qwen3.8-27B-4bit-low-guided-issue-13-session-1.jsonl`   | `mlx-community-Qwen3.8-27B-4bit-low-guided-issue-13`   | `01a056f8-1e8f-7040-9486-a3d567f7ee02` | 2026-08-31 08:38 | reasoning effort low                                         |
| `mlx-community-Qwen3.8-27B-4bit-low-guided-issue-13-session-2.jsonl`   | `mlx-community-Qwen3.8-27B-4bit-low-guided-issue-13`   | `01a05747-4350-77b2-bc04-c13960a97763` | 2026-08-31 10:04 | reasoning effort low, after the restart                      |
| `mlx-community-Qwen3.8-27B-4bit-guided-issue-13-aborted-session.jsonl` | none                                                   | `01a055c0-c135-7a38-85d9-5db8573e0580` | 2026-08-31 02:58 | abandoned attempt at medium effort; no branch, no result row |

## The gemma-4-26b-a4b cutoff

That file holds the run and a later resume in one session. The run is lines
1-236: 116 assistant messages, 115 tool calls, 2026-08-26 01:20 to 03:04, which
is the `telemetry` block of its row. A 20-hour gap follows. From line 237 the
owner gave mid-run help and compacted the context, so that tail breaks the
"no mid-run human help" rule and is not part of the score. Keep the tail for
the record, but stop at line 236 when you recompute telemetry.

## Claude Code runs

The three claude-code blind runs are copied here from `~/.claude/projects/`,
with every absolute home path rewritten to `~`. The e-mail addresses inside
are git authorship from the repo history. Each run has a false start: the
first spawn was killed after three tool calls and respawned four minutes later
with the same prompt. The two claude-code guided runs still keep their
transcripts under `~/.claude/projects/` only.

| File                                                                                     | Branch                                                                     | Session UUID                           | Start (UTC)      | Note                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- | ---------------- | --------------------------------------- |
| `opus-issue-13-session-1.jsonl`                                                          | `opus-issue-13`                                                            | `83a7280d-dd30-4a0b-a038-e071ad6d2118` | 2026-08-28 19:34 | false start, 13 seconds, not scored     |
| `opus-issue-13-session-2.jsonl`                                                          | `opus-issue-13`                                                            | `198df496-4295-4d02-8819-8f92b01a83c2` | 2026-08-28 19:38 | the scored run                          |
| `sonnet-issue-13-session-1.jsonl`                                                        | `sonnet-issue-13`                                                          | `a1d2cdbc-857c-4163-aa3a-f53e90f76e12` | 2026-08-28 19:34 | false start, 11 seconds, not scored     |
| `sonnet-issue-13-session-2.jsonl`                                                        | `sonnet-issue-13`                                                          | `0e139574-8967-4f80-a065-dc52eae4dba5` | 2026-08-28 19:38 | the scored run                          |
| `haiku-issue-13-session-1.jsonl`                                                         | `haiku-issue-13`                                                           | `c74bb092-03d9-43ba-bea8-9948946a5db0` | 2026-08-28 19:34 | false start, 9 seconds, not scored      |
| `haiku-issue-13-session-2.jsonl`                                                         | `haiku-issue-13`                                                           | `9cedeeeb-2086-4306-aa8b-9430d6abb734` | 2026-08-28 19:38 | the scored run                          |
| `accounts-fireworks-models-deepseek-v4-flash-0731-high-guided-v3-issue-13-session.jsonl` | `accounts-fireworks-models-deepseek-v4-flash-0731-high-guided-v3-issue-13` | `01a05f83-634d-7fc9-8041-a406b3272b5d` | 2026-09-02 00:27 | guided v3.0, run-pi-rpc, the scored run |
