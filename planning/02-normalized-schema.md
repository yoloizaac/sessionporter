# 02: Normalized schema

Date: 2026-06-20

## The model

One tool-independent event type (`src/types/index.ts`), one normalized event per
source record (or per content block):

```
{
  schemaVersion: "1.0",
  id, sessionId, source: "claude-code|codex|manual",
  timestamp: ISO | null,
  sequence: 1..N (source order),
  role: user|assistant|tool|system|unknown,
  category: user_prompt|assistant_message|plan|tool_call|tool_result|command|file_operation|error|verification|summary|unknown,
  title, content,
  toolName | null, toolCallId | null, command | null, filePath | null,
  status: success|failure|pending|unknown,
  inferred: boolean,
  sourceType: "original record/block type",
  redactions: ["category", ...]
}
```

## Rules

- Source ordering is preserved; `sequence` is assigned in order; `id` is stable
  (`<source>-<line>-<block>`).
- Missing values stay `null`. Timestamps, statuses, roles, commands, paths, and
  relationships are never invented.
- Anything unrecognised is preserved as `category: "unknown"` with its original
  `sourceType` kept.
- Heuristic classifications (verification from command keywords, reasoning
  labelling) set `inferred: true`.

## Two serializations

- `session.normalized.jsonl`: AgentTrace-native records (so AgentTrace's analytics
  work) with the full normalized event in a `_sessionporter` sidecar. See
  `docs/agenttrace-compatibility.md`.
- `session.events.jsonl`: the flat normalized events above, one per line, for
  tool-independent consumers.

## Why a `summary` category

Claude emits a `summary` record (the session's auto-title). It is kept as a
first-class `summary` event internally and emitted as a `{type:"summary"}` record
so AgentTrace shows it correctly. It is never a failure/verification signal.

## Versioning

`schemaVersion` is `1.0`. Consumers should ignore unknown fields and tolerate
unknown versions; the AgentTrace-native wire shape stays stable across bumps.
