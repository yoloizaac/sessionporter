# 15 — Exported agent-log report

Date: 2026-06-20

## Session-selection method

Read-only discovery was run against the local Claude Code store
(`sessionporter discover --source claude`), filtered by recency, by the project
working directory (`--here`), and by a `sessionporter` query. Metadata only was
inspected (date, project, safe id, event count); no content and no full paths.

## Finding

There is **no clean, single-project SessionPorter session**. Every candidate's
recorded working directory is `…/Downloads` (the parent of this project), and
`--here` and `--query sessionporter` returned nothing. The repository was built
inside one large, multi-project Claude Code conversation that also built a
separate project and performed a Git-identity rewrite.

## Decision

Per the rule "do not export unrelated chats" and the stop-condition "session
selection is ambiguous", the real multi-project conversation is **not** exported
wholesale into this public repository. Doing so would embed unrelated content even
after sanitization.

This is documented honestly rather than worked around. No log was fabricated.

## What is provided as evidence instead

1. The five real subagent **handoff notes** under `planning/agent-handoffs/`,
   which are genuine coding-agent artifacts produced during the build.
2. `planning/09-agent-contributions.md` and `10-problems-and-corrections.md`.
3. A real SessionPorter **sanitized** export of a **synthetic** session under
   `planning/agent-logs/sessionporter-build/bundle/`, demonstrating the exact
   output format on safe data.

## Sanitized mode and redaction

The committed bundle was produced in sanitized mode (the default). Its
`REDACTION_REPORT.md` shows the categories and counts redacted (api_key, email,
home_path, connection_string, token, env_secret), with no values printed.

## Scan results

The committed evidence was scanned for the operator's personal and institutional
email addresses, personal home paths, bearer tokens, API keys, the synthetic
fixture secrets, and connection strings. Result: clean. Only `[REDACTED_*]`
markers remain; no raw secret survives.

## Validation

`sessionporter validate planning/agent-logs/sessionporter-build/bundle` reports
"Bundle is valid (7 files checked)": every checksum matches, the manifest file
list resolves, and `session.normalized.jsonl` parses.

## How to export the real session

The owner can run, from the project directory,
`sessionporter export --source claude --current` to export the real session as
their own local data. It is intentionally not committed here.
