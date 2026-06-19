# Exported agent-session evidence

## What is in `bundle/`

A real SessionPorter **sanitized** export, produced by the tool itself
(`sessionporter export --source claude --mode sanitized`), of a **synthetic**
Claude Code session (`fixtures/claude/demo-project`). It is a faithful
demonstration of exactly what SessionPorter produces, on data that is safe to
publish.

`bundle/` contains: `session.transcript.md`, `session.summary.md`,
`session.normalized.jsonl`, `session.events.jsonl`, `manifest.json`,
`REDACTION_REPORT.md`, `checksums.sha256`, and the bundle's own `README.md`.
It validates: `sessionporter validate planning/agent-logs/sessionporter-build/bundle`.

## Why a synthetic session, not the real build conversation

The real Claude Code conversation that produced this repository was a single,
large, **multi-project** session (its recorded working directory is
`…/Downloads`, and it also built and published a separate project and performed a
Git-identity rewrite). SessionPorter's own rules, and this assessment's
instructions, say: do not export unrelated chats, and stop when session selection
is ambiguous. Exporting that conversation wholesale would embed substantial
unrelated content even after redaction.

So the genuine agent-process evidence in this repository is:

- the five real subagent **handoff notes** in `planning/agent-handoffs/`
  (session-format, redaction-security, portability, skill-UX, final-security),
  which are themselves coding-agent artifacts;
- `planning/09-agent-contributions.md` and
  `planning/10-problems-and-corrections.md` (the honest account, including the
  AgentTrace-native correction);

and the `bundle/` here demonstrates the export format on safe synthetic data.

The owner can export the real session themselves at any time with
`sessionporter export --source claude --current` (it is their local data); see
`planning/15-exported-agent-log-report.md`.

## Sanitization

Sanitized mode: credentials, API keys, tokens, private keys, connection strings,
emails, and home-directory names are replaced with `[REDACTED_*]` markers. No raw
log is included. The synthetic source contains only clearly-fake secrets
(`sk-FAKEKEY…`, `devuser@example.com`, AWS documentation example keys), so the
redaction is visible in `bundle/REDACTION_REPORT.md`.

## Completeness and limitations

This is a small synthetic session, so it is not a complete real development log.
It demonstrates the pipeline and the file formats, not the full scope of the
build. Redaction is heuristic; review before sharing.
