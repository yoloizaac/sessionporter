# 11: Demo script (3 to 5 minutes)

Date: 2026-06-20

Run from the project directory. Point the adapters at the synthetic fixtures so
the demo needs no real session:

```
$env:SESSIONPORTER_CLAUDE_PROJECTS = "$PWD/fixtures/claude"
npm run build
```

## Walkthrough

1. **Discover (read-only).** `node dist/cli/index.js discover`
   Show the numbered list: the synthetic "Add CSV export" Claude session and an
   empty session, plus the experimental Codex session. Point out: metadata only,
   no file paths, no content.

2. **Redaction preview.** `node dist/cli/index.js redact-preview --source claude --session <id>`
   Show the counts: an api_key, an email, home paths, a connection string, a
   bearer token. Nothing is written yet.

3. **Sanitized export (the default).**
   `node dist/cli/index.js export --source claude --session <id> --yes`
   Show the output: review the `REDACTION_REPORT.md` first, then the AgentTrace
   file (`session.normalized.jsonl`), the offline-Claude file
   (`session.transcript.md`), and the zip.

4. **Show redaction worked.** Open `session.transcript.md`: the secrets are
   `[REDACTED_*]` markers; the fail-to-fix-to-verify arc (`npm test` failed, edit,
   `npm test` passed) is readable.

5. **AgentTrace.** Open `session.normalized.jsonl`: AgentTrace-native records with
   linked `tool_use`/`tool_result` ids and a `_sessionporter` sidecar. Upload it
   into AgentTrace and show the tool-usage and verification analytics light up.

6. **Offline Claude.** Upload `session.transcript.md` into a separate Claude
   conversation and paste the evaluation prompt from
   `docs/offline-claude-usage.md`.

7. **Validate.** `node dist/cli/index.js validate <bundle-dir>` shows checksums
   pass.

8. **Private gate.** Show that `--mode private` without `--confirm-private` errors
   with `PRIVATE_NOT_CONFIRMED`, and that sanitized never silently downgrades.

## Talking points

- **AI helped:** four parallel subagents produced the format mappings, redaction
  ruleset, and the AgentTrace-compatibility finding before any code was written.
- **One AI mistake, corrected:** the plan was to emit the brief's flat normalized
  schema; the portability subagent showed AgentTrace ignores it, so the output was
  changed to AgentTrace-native records (with a `_sessionporter` sidecar).
- **One anti-overengineering decision:** zero runtime dependencies (hand-written
  ZIP and arg parser) and Codex kept honestly "experimental".
- **Privacy:** a test traps `http`/`https`/`net`/`dns`/`fetch` and runs a full
  export with zero calls. The tool exports records; it never executes them.
- **Weakest area:** Codex payload coverage (experimental, fixture-tested only) and
  the current-session heuristic.
