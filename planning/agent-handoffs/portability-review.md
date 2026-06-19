# Portability Review: SessionPorter outputs into AgentTrace and offline Claude

Date: 2026-06-20
Author: portability-reviewer (subagent)
Scope: analysis only, no code. Reviews SessionPorter's proposed `session.normalized.jsonl`
and `session.transcript.md` against AgentTrace's actual implemented parser at
`C:\Users\<user>\Downloads\agenttrace\src\parser\*` and event model at
`C:\Users\<user>\Downloads\agenttrace\src\domain\event.ts`.

---

## 0. Headline finding (read this first)

**AgentTrace does not read SessionPorter's `category` or `role` fields. It re-derives
both from raw keys on every record.** `normalizeRecord` (normalize.ts) never looks at a
`category` key at all, and it only reads `role` through `KEYS.role = ['role','sender','author']`
as a *fallback*. Classification is driven by, in priority order:

1. a nested `message.content[]` array whose blocks carry `type: 'text' | 'thinking' | 'tool_use' | 'tool_result'`, else
2. a nested `message.content` string, else
3. flat top-level keys: `error/err/exception/stderr`, then `command/cmd/...`, then `tool/tool_name/toolName/name`, then `file_path/filePath/path/file/filename`, then `content/text/message/body/value`, with `type === 'summary'` special-cased.

Therefore SessionPorter's flat, camelCase normalized record
(`{schemaVersion, category, role, toolName, filePath, ...}`) will be **parsed without
crashing but mostly misclassified**, because:

- `category` is ignored, so AgentTrace re-guesses from whatever raw keys happen to match.
- `toolName` / `filePath` *are* in the probe lists (`KEYS.tool` includes `toolName`, `KEYS.path` includes `filePath`), so those specific camelCase names are tolerated. But...
- AgentTrace's **analytics layer (`analyze.ts`) keys entirely off `rawType === 'tool_use'` / `'tool_result'` and a `tool_use_id` string on `rawData`.** SessionPorter's flat events never produce `rawType: 'tool_use'`, so **tool-usage stats, ok/error outcome linking, verification pass/fail, and retry detection all come back empty** even when the timeline cards look roughly right.

**Verdict: INGESTS (never throws) but DOES NOT round-trip correctly if SessionPorter emits
its own flat schema.** The fix is not to rename a few fields. SessionPorter should emit the
**Claude-Code-shaped envelope** AgentTrace was built around. See section 1.

---

## 1. Compatibility verdict and field-by-field mapping

### 1a. If SessionPorter emits its proposed flat schema (one record per line)

Example flat record:
`{"schemaVersion":"1.0","id":"...","role":"assistant","category":"tool_call","toolName":"Bash","command":"npm test","filePath":null,"content":"...","status":"unknown", ...}`

How AgentTrace reads each field:

| SessionPorter field | AgentTrace behaviour |
|---|---|
| `id` | Read via `pickString(rec, ['uuid','id','message_id'])`; used as `baseId`. Honoured. Note IDs are still re-suffixed `${uuid}-${index}` so they stay unique even on collision. |
| `timestamp` (or null) | Read via `KEYS.timestamp`. `null` is fine (pickString returns undefined; timestamp stays `undefined`, never fabricated). Honoured. |
| `role` | Read via `KEYS.role` as fallback only. Mapped through `toRole()` (`user`/assistant`/system`/tool`/`unknown`). Honoured **only when no `message.content` array is present**. |
| `category` | **IGNORED.** Re-derived. This is the core mismatch. |
| `title` | **IGNORED.** AgentTrace generates its own title. Harmless. |
| `content` | Read via `KEYS.content = ['content','text','message','body','value']`. Honoured and flattened safely. |
| `toolName` | Read via `KEYS.tool` (includes `toolName`). Honoured for the card, but does NOT set `rawType:'tool_use'`, so it is invisible to `analyze.ts` tool stats. |
| `command` (or null) | Read via `KEYS.command`. Presence routes the flat record to `category:'command'`. Honoured for the card. |
| `filePath` (or null) | Read via `KEYS.path` (includes `filePath`). Routes to `category:'file_operation'` if no command/tool/error. Honoured for the card. |
| `status` | NOT read on the way in. `flatRecordToEvent` sets its own status (`unknown` for tool/command/file, `error` for errors). SessionPorter's `status` is preserved only inside `rawData`. |
| `toolCallId` | Not probed. Preserved in `rawData` only. Critically, **`analyze.ts` looks for `tool_use_id` (snake_case) on `rawData`, not `toolCallId`**, so result-to-call linking will NOT happen. |
| `sourceType`, `sequence`, `schemaVersion`, `inferred`, `redactions` | Unknown keys. Ignored by classification, preserved untouched in `rawData`. Harmless. |

Net effect of the flat schema: user prompts and assistant text classify acceptably
(role fallback works), but every tool call lands as a generic `tool_call`/`command`/`file_operation`
card with **no analytics**, and tool_result outcomes never link back to their calls.

### 1b. RECOMMENDED: emit the Claude-Code envelope (the shape AgentTrace tests assert)

AgentTrace's `parser.test.ts` documents exactly what it ingests with full fidelity. To get
correct classification **and** working analytics with **zero re-inference of the wrong kind**,
SessionPorter's `session.normalized.jsonl` should emit one line per record in this shape:

**User prompt**
```json
{"type":"user","timestamp":"<iso>","uuid":"<id>","message":{"role":"user","content":"do a thing"}}
```

**Assistant text / thinking**
```json
{"type":"assistant","timestamp":"<iso>","uuid":"<id>","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
```

**Tool call** (this is what makes analytics work)
```json
{"type":"assistant","timestamp":"<iso>","message":{"role":"assistant","content":[{"type":"tool_use","id":"call_1","name":"Bash","input":{"command":"npm test"}}]}}
```

**Tool result** (must echo the call id as `tool_use_id`)
```json
{"type":"user","timestamp":"<iso>","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"call_1","is_error":false,"content":"a b c"}]}}
```

With this shape AgentTrace classifies **without any inferred flags** for everything except
genuine verification/retry heuristics (which are meant to be inferred):

- `tool_use` block -> `category:'tool_call'`, `rawType:'tool_use'`, `toolName`, and `command`/`filePath` pulled from `input.command` / `input.file_path|filePath|path|notebook_path`.
- `classify.ts` then upgrades by tool name: `ExitPlanMode` -> `plan` (structural, not inferred); Read/Write/Edit/etc -> `file_operation`; Bash/shell/etc -> `command`. A command matching the verification regex (npm test, tsc, pytest, cargo test, ...) -> `verification` with `inferred:true`.
- `tool_result` block with `is_error:true` -> `category:'error'`, `status:'error'`; otherwise `tool_result`/`ok`.
- `analyze.ts` links result to call via `tool_use_id`, producing tool-usage counts, ok/error tallies, verification pass/fail, and inferred retry notes.

### 1c. Exact minimum field set per category (Claude envelope) for clean ingestion

| Target category | Minimum AgentTrace needs |
|---|---|
| `user_prompt` | `{"type":"user","message":{"role":"user","content":"<text or block array>"}}` |
| `assistant_message` | `{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}` (or `type:"thinking"`) |
| `tool_call` | assistant `message.content[]` block `{"type":"tool_use","id":"<id>","name":"<Tool>","input":{...}}`. Put shell text under `input.command`; file path under `input.file_path`. |
| `command` | a `tool_use` whose `name` is a shell tool (Bash/shell/pwsh/...) OR a flat record carrying `command`. |
| `file_operation` | a `tool_use` whose `name` is a file tool (Read/Write/Edit/...) OR a flat record carrying `file_path` and no command/tool. |
| `plan` | a `tool_use` with `name:"ExitPlanMode"` (input may hold `plan`). |
| `verification` | a `command`/`tool_use` whose command text matches the verification regex. Always emitted as `inferred` by AgentTrace; do not pre-set it. |
| `tool_result` / `error` | user `message.content[]` block `{"type":"tool_result","tool_use_id":"<matching id>","is_error":<bool>,"content":...}`. `is_error:true` -> `error`. |
| `error` (flat) | any record carrying `error`/`stderr`/`exception`, or `is_error:true`, or a `level`/`severity`/`status` of `"error"`. |

`id` (as `uuid`/`id`) and `timestamp` are optional everywhere but strongly recommended:
the `id` on each `tool_use` and the matching `tool_use_id` on each `tool_result` are what
power analytics, and timestamps drive the session time range.

---

## 2. Extra-field tolerance

Confirmed harmless. AgentTrace preserves the entire raw record on `rawData` and only ever
reads a fixed allow-list of keys (the `KEYS` table plus block `type`). Any extra
SessionPorter fields are inert:

- `schemaVersion`, `sequence`, `sourceType`, `redactions`, `toolCallId`, `inferred`,
  `status`, `category`, `title`: none collide with a probed key in a way that misroutes a
  Claude-shaped record. They ride along inside `rawData` and surface only in the raw
  drawer. No crash, no misclassification.
- One caveat: SessionPorter's `redactions` array on each record is preserved but never
  rendered by AgentTrace. If reviewers should *see* what was redacted, surface redaction
  markers inline in `content` (see section 4), not only as a sidecar array.
- Do NOT name any extra field `command`, `cmd`, `input`, `tool`, `name`, `file`, `path`,
  `error`, `stderr`, `content`, `text`, `body`, `value`, `level`, `severity`, or `status`
  at the top level of a record unless it carries that semantic meaning. Those are live
  probe keys and an off-label value there *will* misroute or mislabel a flat record.

---

## 3. Category alignment: `summary`

SessionPorter proposes a `summary` category. AgentTrace's `EventCategory` union has no
`summary` member, so a record SessionPorter labels `category:"summary"` would (per section 0)
be re-derived anyway. AgentTrace *does* have a dedicated path, but it is keyed on
**`type === 'summary'`**, not on a category field:

```
if (recType === 'summary') -> category:'unknown', role:'unknown', title:'Session title',
                              content = rec.summary ?? content, rawType:'summary'
```

So a Claude-style summary record (`{"type":"summary","summary":"..."}`) lands as a clean
`unknown` event titled "Session title" with its text preserved. That is the intended,
graceful outcome.

**Recommendation:** SessionPorter should emit the session summary as
`{"type":"summary","summary":"<text>"}` (Claude shape). Do **not** invent a
`category:"summary"` value, since AgentTrace ignores `category` and has no such category;
it would just fall to `unknown` with a generic title and lose the nicer "Session title"
label. Mapping to AgentTrace's `summary` *rawType* via `type:"summary"` is the cleanest
ingestion. If portability beyond AgentTrace matters, `unknown` is the honest category to
record internally, but the wire format that triggers the nice path is `type:"summary"`.

---

## 4. Transcript readability for an offline Claude audit

Goal: a Markdown file a model can read top-to-bottom and audit on evidence, with **no
fabricated AI summaries inside the evidence section**. Recommended structure for
`session.transcript.md`:

1. **Front-matter / header block** (factual metadata only): session id, source
   (`claude-code`), export tool + `schemaVersion`, capture time range (first/last
   timestamp), counts (events, tool calls, files touched, failures), and a one-line
   redaction notice ("N spans redacted; markers shown inline as `[REDACTED:<kind>]`").
   Keep this purely mechanical, not interpretive.

2. **How to read this file** (short, static): explains the section order, the meaning of
   each heading, the status markers (ok / error / unknown), and that redaction markers
   denote removed secrets, not missing data.

3. **Chronological transcript** (the evidence; the bulk of the file). One section per
   event in `sequence` order, each with a stable anchor heading so a reviewer can cite it:
   - Heading: `### [<sequence>] <ROLE> · <category> · <timestamp or "no timestamp">`
   - User prompts and assistant messages: fenced or block-quoted body, verbatim.
   - **Tool calls**: tool name, and the command or target file in a fenced code block
     labelled by language (` ```bash ` for commands). Show `toolCallId` so the matching
     result is locatable.
   - **Tool results / command output**: fenced output block, clearly marked as output,
     truncated with an explicit "… (truncated, N lines omitted)" note rather than silently.
     Tag the status (ok/error).
   - **File operations**: the file path as a heading or inline code, plus the diff/content
     body in a fenced block.
   - **Errors**: call them out with a clear `> [!error]`-style marker or an `ERROR:` prefix
     and the stderr/message verbatim.
   - **Verification**: label inferred verification commands as such ("inferred: looks like
     a test/lint/build command") so the model does not treat the inference as ground truth.
   - **Redaction markers**: inline `[REDACTED:secret]` / `[REDACTED:path]` etc. exactly
     where the removed span was, so the reviewer sees that something was there.
   This section must contain **only transcript-derived content**. No model-written summary,
   no editorializing, no invented "the agent then decided to…". Verbatim or mechanically
   derived text only.

4. **Mechanical analysis appendix** (clearly separated, after the evidence): the same
   non-inferential aggregates AgentTrace computes (tool-usage table, files touched list,
   failure list, inferred-retry notes explicitly flagged "inferred"). This is fine because
   it is reproducible arithmetic over the transcript, not narrative. Keep the inferred
   items labelled so the auditor can discount them.

Key rule for the offline audit to be trustworthy: the chronological section is pure
evidence; anything interpretive lives in the appendix and is flagged as derived/inferred.
That mirrors AgentTrace's own design rule (`inferred` flags, "never present a guess as
fact").

---

## 5. Schema-versioning rules

SessionPorter side:
- `schemaVersion` is `MAJOR.MINOR` (e.g. `"1.0"`). Bump **MINOR** for additive,
  backward-compatible changes (new optional fields, new emitted record types that older
  consumers can ignore). Bump **MAJOR** only for breaking changes: renaming/removing a
  field a consumer relied on, or changing the meaning/shape of an existing field
  (e.g. moving tool calls out of the Claude `message.content[]` envelope).
- Keep `schemaVersion` as a top-level string on every record (cheap, and it travels inside
  `rawData` so a future AgentTrace could read it). Also record it once in the transcript
  header.
- Treat the **wire shape** (Claude envelope from section 1b) as the contract, not the flat
  internal schema. If SessionPorter ever changes the wire shape, that is a MAJOR bump.

AgentTrace side (recommendation, since it currently ignores version entirely):
- AgentTrace should remain **version-agnostic and forward-compatible**: never hard-fail on
  an unknown `schemaVersion`. Its existing "probe known keys, preserve the rest as
  `rawData`, mark anything unclassifiable `unknown`" model already gives this for free.
- If AgentTrace ever wants to act on version, it should treat unknown MAJOR versions as
  "parse leniently, surface a non-blocking warning" (mirroring its existing
  `ParseWarning` mechanism) and never drop records. An unknown MINOR within a known MAJOR
  needs no warning at all.

---

## 6. Unnecessarily tool-specific fields to drop for portability

The portable wire format should be the lowest-common-denominator Claude/JSONL envelope.
Candidates to drop, demote to `rawData`-only, or rename:

- `category`, `title`, `status`, `inferred` (top-level): **drop from the wire format.** They
  are SessionPorter's *internal* normalized model, but AgentTrace (and any tolerant
  consumer) re-derives category/title/status and computes inferred itself. Emitting them
  pre-set is dead weight at best and a false signal at worst (a consumer that *did* trust a
  pre-set `category` would inherit SessionPorter's classification opinions instead of its
  own). Keep them internal; do not put them on the portable record.
- `toolCallId` (camelCase): **rename to `tool_use_id` on tool-result records** (and use
  `id` on the `tool_use` block). This is the single highest-value change for analytics:
  AgentTrace's `analyze.ts` matches on `tool_use_id` literally. camelCase `toolCallId` is
  invisible to it.
- `sourceType`: tool-specific. Fine to keep inside `rawData`/header for provenance, but it
  carries no meaning to a generic consumer; do not rely on it for portability.
- `sequence`: keep (useful for stable ordering in the transcript), but know AgentTrace
  does not read it; it orders by input line order. Harmless either way.
- `schemaVersion`, `redactions`: keep, but as metadata that rides in `rawData` / header.
  AgentTrace ignores both; redaction visibility must come from inline markers in `content`
  (section 4), not the array.

Rule of thumb: a field only belongs on the portable record if it is **source-faithful
evidence** (role, content, tool name, command, file path, timestamps, the call/result id
linkage). Everything that is SessionPorter's *interpretation* (category, title, status,
inferred) should stay in SessionPorter's internal model and out of the bundle, because the
target re-derives it and an offline reviewer should audit the raw evidence, not
SessionPorter's labels.

---

## Bottom line

Emit the **Claude-Code `message.content[]` envelope** (user/assistant/tool_use/tool_result/summary),
not the flat camelCase normalized schema. With that, AgentTrace ingests with correct
categories and working analytics and **no spurious re-inference**. Keep SessionPorter's
flat schema as an internal model only. Match `tool_use_id` exactly, keep extra fields (they
ride harmlessly in `rawData`), emit summaries as `type:"summary"`, and make the transcript
pure evidence up front with all interpretation flagged and quarantined in an appendix.

-- portability-reviewer (subagent), 2026-06-20
