# 08: Decisions and trade-offs

Date: 2026-06-20

## Zero runtime dependencies

A tool that handles secrets and is meant to be trusted should have the smallest
possible supply chain. SessionPorter uses only Node's standard library: streaming
JSONL via `node:readline`, a hand-written ZIP writer over `node:zlib`, hashing via
`node:crypto`. No `commander`, no `archiver`, no `adm-zip`. The cost is a little
more code (the ZIP writer, the arg parser); the benefit is nothing third-party can
exfiltrate data or break the no-network guarantee.

## AgentTrace-native normalized.jsonl (overriding the brief's flat schema)

The portability reviewer read AgentTrace's actual parser and found it ignores a
flat `category` field and re-derives everything from raw Claude block shapes, with
analytics keyed on linked `tool_use`/`tool_result` ids. Emitting only the brief's
flat schema would have produced empty analytics in AgentTrace. So
`session.normalized.jsonl` emits AgentTrace-native records with a `_sessionporter`
sidecar, and the flat schema is still shipped as `session.events.jsonl`. This is a
deliberate, evidence-based correction, documented in
`docs/agenttrace-compatibility.md`.

## Sanitized by default, hard private gate

Sanitized is the default and never silently downgrades. Private requires an
explicit `--confirm-private` (or typing "CONFIRM PRIVATE" interactively), keeps
more content, but still blocks credentials and private keys. Disabling even that
needs a separate `--allow-secrets` flag that only works in private mode. There is
no easy `--no-redaction`.

## Honest current-session resolution

A CLI cannot know which session invoked it, so `--current` is a documented
heuristic (newest session for the working directory) and refuses to guess when
nothing matches. This avoids the trap of confidently exporting the wrong session.

## Codex marked experimental, not supported

Codex's local format is accessible and was fixture-tested, but payload shapes vary
by version and reasoning is encrypted. Calling it "supported" would overclaim, so
it is experimental, warns on every export, and has a manual fallback.

## What was deliberately simplified

No database, no server, no frontend, no AI summarization, no quality score. The
manual importer infers roles conservatively and labels them rather than guessing
tool metadata. Discovery reads bounded metadata rather than every file in full.
