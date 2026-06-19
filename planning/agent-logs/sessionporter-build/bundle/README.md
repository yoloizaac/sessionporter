# SessionPorter bundle

Exported 2026-06-19T19:33:02.879Z from **claude-code** in **sanitized** mode.

## Files

- `session.normalized.jsonl` — the **file to upload into AgentTrace**. One record per line in AgentTrace-native shape, with a `_sessionporter` field carrying the normalized event.
- `session.transcript.md` — the **file to upload into an offline Claude conversation** for a human-readable review.
- `session.summary.md` — deterministic counts (tools, commands, files, failures, verification). Optional second upload for context.
- `manifest.json` — machine-readable metadata, file list, and checksums.
- `REDACTION_REPORT.md` — what was redacted, by category and count (never the values). **Read this before sharing.**
- `checksums.sha256` — SHA-256 of every other file, for integrity checking.

## Which file goes where

| Destination | File |
| --- | --- |
| AgentTrace (upload) | `session.normalized.jsonl` |
| Offline Claude conversation | `session.transcript.md` (optionally `session.summary.md`) |

## Privacy

- This bundle is **sanitized**.
- Likely secrets, credentials, emails, and home-directory names were redacted to `[REDACTED_*]` markers.
- Raw untouched logs are **not** included.

## Completeness

Records are the local Claude Code session log. Plaintext 'thinking' (model reasoning) blocks are included where present; truncated tool outputs are marked. A single .jsonl can be a resumed or forked session, so it may be a partial logical conversation. No cloud account was accessed.

## Safe-sharing checklist

1. Open `REDACTION_REPORT.md` and confirm the categories and counts look right.
2. Skim `session.transcript.md` for anything sensitive the heuristics missed.
3. Never upload a private bundle (or `session.raw.*`) to a public place.
4. Remember the transcript may contain proprietary code or personal information.
