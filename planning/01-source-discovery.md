# 01: Source discovery

Date: 2026-06-20. Grounded in the session-format-investigator handoff.

## Locations (read-only)

- Claude Code: `~/.claude/projects/<slug>/<uuid>.jsonl`, one JSON object per
  line. Overridable for tests via `SESSIONPORTER_CLAUDE_PROJECTS`.
- Codex (experimental): `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO>-<uuid>.jsonl`.
  Overridable via `SESSIONPORTER_CODEX_SESSIONS`.

Discovery only ever touches these documented directories. It never scans the
whole drive and never reads unrelated folders.

## Metadata only, first

Discovery returns metadata (date, title, project, safe session id, record count),
never content. Absolute file paths are not shown in default/sanitized output.

## Filtering and selection

Sessions can be filtered by current working directory (`--here`), recency
(`--recent <days>`), and a free-text query, then shown as a numbered list capped
by `--limit`. Exactly one session is exported unless the user explicitly requests
otherwise.

## Current-session resolution (honest)

A standalone CLI cannot observe which session invoked it. So `--current` resolves
the newest session whose recorded `cwd` (Claude) or `session_meta.cwd` (Codex)
matches the working directory, and the result records exactly how it was resolved
("heuristic"). When nothing matches, the CLI does not guess: it errors with
`CURRENT_AMBIGUOUS` and the user picks from a list.

A subtlety from the investigation: a Claude filename uuid is not always the
internal `sessionId` (resume/fork), so the adapter reads `sessionId` from the
records and matches on it, falling back to the filename.

## Performance

Discovery reads file stats for all candidates, sorts by recency, and reads
head-lines plus a record count only for a bounded candidate set, so listing stays
fast even with hundreds of session files.
