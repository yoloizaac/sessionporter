# Codex adapter investigation

Date: 2026-06-20

## Installed environment

- `codex` CLI is on PATH: `codex-cli 0.118.0`.
- Local session store exists: `~/.codex/sessions/` with date-partitioned files
  `YYYY/MM/DD/rollout-<ISO>-<uuid>.jsonl` (6 files observed).

## Accessible local format (structure only, no content read)

Every line is `{ timestamp, type, payload }`. The `type` set observed:
`session_meta`, `turn_context`, `event_msg`, `response_item`.

- `session_meta.payload` carries `id`, `cwd`, `cli_version`, `originator`.
- `response_item.payload` is polymorphic: `message` (role + `content[]` of
  `input_text` / `output_text`), `function_call`, `local_shell_call`,
  `function_call_output`, `reasoning`, and search variants.
- The same turn appears in both `response_item` and `event_msg`, so the channels
  must be de-duplicated.
- `reasoning.content` is null; only a `summary[]` plus `encrypted_content` are
  present. Model reasoning is **encrypted and not recoverable**.

## Selection and privacy

- A session is selected by the `<uuid>` in the filename (and confirmed by
  `session_meta.payload.id`). "Current" is resolved heuristically as the newest
  session whose `session_meta.cwd` matches the working directory.
- Access is read-only, local files only. No cloud, no auth bypass.

## Verdict: EXPERIMENTAL

Conditions met: the format is locally accessible and selectable, access is
read-only, and a synthetic fixture can be (and was) created. Conditions not fully
met for "supported": payload shapes vary by Codex version and were only confirmed
structurally against local files plus a synthetic fixture, not exhaustively; and
the dual-channel de-duplication is a heuristic.

## What was built

- A read-only adapter (`src/adapters/codex/`) that de-duplicates the `event_msg`
  channel, maps messages / shell calls / call outputs / reasoning, and preserves
  unknown payloads as `unknown`.
- A synthetic fixture (`fixtures/codex/.../rollout-*.jsonl`) and parser tests.
- Honest labelling: every Codex export carries an EXPERIMENTAL warning and states
  that encrypted reasoning is not recoverable.

## Fallback

If a Codex session does not parse, use the manual importer:
`sessionporter import-transcript <file>`. A dedicated Codex skill was
intentionally not built; the CLI exposes `--source codex` directly.

## What would justify promoting to "supported"

A documented, stable Codex rollout schema, confirmation across multiple Codex
versions, and a non-heuristic de-duplication signal between the two channels.

Investigation by the lead agent, grounded in the session-format-investigator handoff.
