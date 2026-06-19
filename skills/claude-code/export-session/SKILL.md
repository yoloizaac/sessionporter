---
name: export-session
description: Export the current (or a chosen) Claude Code session into a portable, privacy-aware SessionPorter bundle for AgentTrace and offline review. Use when the user says "export this session", "export-session", "save this conversation", "make a SessionPorter bundle", "export my Claude Code session", "redact and export this chat", "bundle this session for AgentTrace", or wants a sanitized transcript to upload into another Claude conversation for an evidence-based audit. Defaults to sanitized; private full-fidelity export requires explicit confirmation.
metadata:
  tags: [export, privacy, redaction, agenttrace, sessions]
---

# /export-session

```
HARD SAFETY INVARIANTS
- Sanitized export is the DEFAULT. Never silently fall back from sanitized to private.
- Private (full-fidelity) export requires an explicit, deliberate confirmation.
- All export logic lives in the `sessionporter` CLI. This skill only orchestrates it; it never re-implements parsing, redaction, or bundling.
- Read-only discovery. Never guess the current session when it is ambiguous: show a numbered list and let the user pick exactly one.
- Nothing is uploaded. The CLI runs locally and writes to .sessionporter/exports/ (git-ignored).
```

## What it does

Turns one Claude Code (or Codex, or pasted) session into a bundle containing
`session.normalized.jsonl` (for **AgentTrace**), `session.transcript.md` (for an
**offline Claude conversation**), a deterministic summary, a manifest, a
`REDACTION_REPORT.md`, checksums, and an optional zip. Secrets, credentials,
emails, and home-directory names are redacted in sanitized mode.

## The CLI

Run the SessionPorter CLI and parse its `--json` envelope `{ ok, command, data | error }`.
Use the built binary (`node <sessionporter>/dist/cli/index.js`) or `sessionporter`
if it is on PATH. Every command below takes `--json`.

## Workflow

1. **Resolve the session.**
   - Default / `current`: `sessionporter export --source claude --current --json` resolves the newest session for the working directory. If the CLI returns `error.code = CURRENT_AMBIGUOUS` or the user asked to `choose`, run `sessionporter discover --source claude --json`, present the numbered list (date, title, project, safe id), and ask the user to pick exactly one. Then use its `safeSessionId` with `--session`.
   - `import <file>`: run `sessionporter import-transcript <file> --json`.

2. **Preview (always).** Run `sessionporter redact-preview --source claude --session <id> --json` and show the session metadata plus the redaction counts (for example "2 emails, 4 local paths, 1 possible token"). This is the only confirmation needed for sanitized mode.

3. **Choose mode.** Default to **sanitized**. Only do a **private** export if the user explicitly asks for full fidelity; then call `sessionporter export ... --mode private --confirm-private --json` and warn that tool outputs may contain secrets. Never add `--confirm-private` unless the user asked for private.

4. **Export.** `sessionporter export --source claude --session <id> --mode sanitized --json`.

5. **Report.** From the `data.outputs`, tell the user, in this order:
   - **Review before sharing:** `REDACTION_REPORT.md` (and the redaction count).
   - **Upload to AgentTrace:** `session.normalized.jsonl`.
   - **Upload to an offline Claude conversation:** `session.transcript.md`.
   - **Complete bundle:** the `.zip`.
   Then remind: review the redaction report, do not upload a private bundle publicly, and the transcript may contain proprietary code or personal information.

## Argument forms

| Invocation | Action |
| --- | --- |
| `/export-session` | resolve current session, sanitized |
| `/export-session current` | same, explicit |
| `/export-session choose` | list sessions, pick one, sanitized |
| `/export-session current sanitized` | current, sanitized |
| `/export-session <session-id> sanitized` | a specific session, sanitized |
| `/export-session import <file>` | manual transcript import |

## Failure handling

Map CLI `error.code` to a friendly message: `NO_SESSIONS` (none found),
`CURRENT_AMBIGUOUS` (show the picker), `SESSION_NOT_FOUND` (re-list),
`OUTPUT_EXISTS` (an export already exists), `PRIVATE_NOT_CONFIRMED` (private needs
confirmation), `VALIDATION_FAILED` (do NOT claim success; show the errors).

## Installation

Copy this folder to `~/.claude/skills/export-session/`. Installation is a manual,
approval-gated step; do not install it globally as part of an automated build.
See `docs/skill-installation.md`.
