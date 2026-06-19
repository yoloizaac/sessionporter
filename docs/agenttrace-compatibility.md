# AgentTrace compatibility

## Which file to upload

Upload **`session.normalized.jsonl`** into AgentTrace.

## Why it is shaped the way it is

AgentTrace has its own tolerant parser. A design review of AgentTrace's actual
code found a decisive fact: **AgentTrace ignores a flat `category` field and
re-derives the category from raw Claude-style record shapes.** Its analytics
(tool usage, failure-to-retry, verification) key off raw `tool_use` / `tool_result`
blocks linked by id, not off a normalized event's fields.

So if SessionPorter emitted only its flat normalized schema, AgentTrace would
ingest it without crashing but would show empty tool-usage, no failure linkage,
and no retry or verification detection.

To make AgentTrace's analytics work, `session.normalized.jsonl` emits
**AgentTrace-native records**: the Claude `message.content[]` envelope with
`tool_use` and `tool_result` blocks linked by matching ids, plus `summary`
records and `ExitPlanMode` plan blocks. Each line also carries a `_sessionporter`
field with the full normalized event; AgentTrace keeps it inertly in its raw
drawer.

This is a deliberate, evidence-based decision (the brief's suggested flat schema
was overridden in favour of real compatibility). SessionPorter's own
tool-independent view is still available as `session.events.jsonl` (one flat
`NormalizedEvent` per line) and inside each `_sessionporter` sidecar.

## Field mapping

| SessionPorter category | AgentTrace-native record |
| --- | --- |
| `user_prompt` | `{type:"user", message:{role:"user", content:"<text>"}}` |
| `assistant_message` | `{type:"assistant", message:{role:"assistant", content:[{type:"text", text}]}}` |
| `plan` | assistant `tool_use` named `ExitPlanMode`, `input.plan` |
| `command` / `tool_call` / `file_operation` / `verification` | assistant `tool_use` `{id, name, input:{command?, file_path?}}` |
| `tool_result` | user `{type:"tool_result", tool_use_id:<id>, is_error:false, content}` |
| `error` (tool) | user `tool_result` with `is_error:true` |
| `error` (generic) | `{type:"error", error}` |
| `summary` | `{type:"summary", summary}` |
| `unknown` | `{type:"<sourceType>", content}` |

The `tool_use.id` equals the matching `tool_result.tool_use_id`; that linkage is
what powers AgentTrace's tool ok/error counts and its retry/verification heuristics.

## Schema versioning

`_sessionporter.schemaVersion` is `1.0`. AgentTrace does not read it; it treats
every line tolerantly and preserves unknown fields. If SessionPorter bumps the
schema, the AgentTrace-native shape stays stable, so older AgentTrace builds keep
working.

## Validation

`sessionporter validate <bundle>` confirms every line of `session.normalized.jsonl`
is valid JSON and the checksums match. AgentTrace's own parser additionally
tolerates malformed lines as warnings, so a partial file still opens. If
AgentTrace ever rejected the file, the fix belongs in SessionPorter (do not edit
AgentTrace).

## Limitations

- `unknown` events appear in AgentTrace as generic/unknown entries (honest).
- SessionPorter's `summary` maps to AgentTrace's "Session title"; it is not a
  failure/verification signal.
- Redacted values appear as `[REDACTED_*]` markers in AgentTrace just as in the
  transcript.
