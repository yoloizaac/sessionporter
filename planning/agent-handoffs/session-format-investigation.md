# Session Format Investigation — Claude Code & Codex CLI

Date: 2026-06-20
Author: session-format-investigator (subagent)
Scope: STRUCTURE ONLY. No session content, values, prompt text, file paths, or tool
inputs/outputs were copied. Everything below is key-names, record taxonomy, and
file-layout shape, sampled read-only across the local stores.

Local sample size: ~1,188 Claude `.jsonl` files across 20 project dirs;
6 Codex `.jsonl` rollout files. Variant coverage notes are called out per section.

---

## 1. Claude Code session records

### 1.1 File layout & selection
- Path: `~/.claude/projects/<project-slug>/<uuid>.jsonl`. One JSON object per line
  (JSONL). The `<project-slug>` is a path-derived directory name; the `<uuid>` is the
  filename stem.
- Selection signal fields present on the main conversational records
  (`user`, `assistant`, `attachment`): `sessionId`, `cwd`, `timestamp`, `version`,
  `gitBranch`, `uuid`, `parentUuid`.
- IMPORTANT heuristic caveat: the filename stem UUID is NOT guaranteed to equal the
  in-record `sessionId` (confirmed mismatch in the local sample). Resume/fork produces
  files whose name differs from the internal `sessionId`. So do not assume
  filename == sessionId.

### 1.2 Top-level `type` taxonomy (OPEN set — handle unknowns)
Observed values and rough frequency from the sample:
`assistant`, `user`, `attachment`, `last-prompt`, `ai-title`, `queue-operation`,
`system`, `custom-title`, `mode`. Treat as open; a parser MUST tolerate unseen types.

Top-level keys observed across all types (union): `type`, `uuid`, `parentUuid`,
`sessionId`, `cwd`, `gitBranch`, `timestamp`, `version`, `message`, `content`,
`isSidechain`, `isMeta`, `userType`, `entrypoint`, `level`, `subtype`, `toolUseID`,
`toolUseResult`, `requestId`, `isApiErrorMessage`, `apiErrorStatus`, `error`,
`stopReason`, `isCompactSummary`, `compactMetadata`, `leafUuid`, `logicalParentUuid`,
`isVisibleInTranscriptOnly`, `attachment`, `operation`, `mode`, `aiTitle`,
`customTitle`, `lastPrompt`, `promptId`, `promptSource`, `origin`,
`hookCount`/`hookErrors`/`hookInfos`/`hookAdditionalContext`, `agentId`,
`attributionAgent`, `attributionMcpServer`, `attributionMcpTool`,
`attributionPlugin`, `attributionSkill`, `sourceToolUseID`,
`sourceToolAssistantUUID`, `hasOutput`, `preventedContinuation`,
`permissionMode`, `stopReason`, `subtype`.

### 1.3 `message.content` block shapes
- ASSISTANT (`message.content` is an array) block types: `tool_use`, `thinking`,
  `text`. The assistant `message` object also carries: `id`, `model`, `role`,
  `usage`, `stop_reason`, `stop_sequence`, `stop_details`, `container`,
  `context_management`, `diagnostics`.
  - `tool_use` block keys: `type`, `id`, `name`, `input`, `caller`
    (`caller` distinguishes main-thread vs subagent invocations).
  - `thinking` block keys: `type`, `thinking`, `signature` (the reasoning text is
    present in plaintext, plus an encrypted `signature`).
  - `text` block keys: `type`, `text`.
- USER (`message.content` is usually an array, sometimes a string): in the sample,
  ~94% array vs ~6% string. Array block types: `tool_result` (dominant), `image`,
  `text`, `document`. So a user record is frequently a tool-result carrier, NOT a
  typed prompt string.
  - `tool_result` block keys: `type`, `tool_use_id`, `content`, `is_error`.
  - `tool_result.content` is itself string OR array (sample: ~72% string, ~28%
    array). When array, inner block types: `text`, `image`, `tool_reference`.

### 1.4 MCP tool naming
Tool names follow `mcp__<server>__<tool>`. Split on `__` to recover server + tool.
Multiple distinct MCP servers present in the local sample.

### 1.5 Auxiliary record shapes (keys only)
- `system`: carries `subtype`, `level`, `content`, `isMeta`, `compactMetadata`,
  `toolUseID`, hook fields (`hookCount`/`hookErrors`/`hookInfos`/
  `hookAdditionalContext`), retry fields (`maxRetries`, `retryAttempt`, `retryInMs`),
  `stopReason`, `preventedContinuation`, plus the standard selection fields.
- `attachment`: standard selection fields + `attachment`.
- `queue-operation`: `type`, `sessionId`, `timestamp`, `operation`, `content`.
- `mode`: `type`, `sessionId`, `mode`.
- `ai-title`: `type`, `sessionId`, `aiTitle`. `custom-title`: `+customTitle`.
- `last-prompt`: `type`, `sessionId`, `lastPrompt`, `leafUuid`.

### 1.6 Claude → normalized category mapping
| Source record / block                          | Normalized category |
|-------------------------------------------------|---------------------|
| `user` w/ string content, or array `text`       | user_prompt         |
| `user` array carrying `tool_result`             | tool_result         |
| `assistant` `text` block                        | assistant_message   |
| `assistant` `thinking` block                    | assistant_message (reasoning subtype) |
| `assistant` `tool_use` block                    | tool_call           |
| `tool_use` whose name is a shell/edit/write tool| command / file_operation (resolve by tool name) |
| `tool_result` with `is_error: true`             | error               |
| `system` (hooks, retries, compact, errors)      | system / error / summary (by subtype) |
| `isCompactSummary` / `ai-title` / `custom-title`| summary             |
| `queue-operation`, `mode`, `last-prompt`        | unknown / control (non-content) |
| any unseen `type`                               | unknown             |

Notes: there is no first-class `plan` record; plans appear as assistant text or as a
specific tool (ExitPlanMode-style) — map via tool name, not record type. `verification`
is also not a record type; infer it from tool-call patterns if needed.

---

## 2. Codex CLI records (codex-cli 0.118.0)

### 2.1 File layout & selection
- Path: `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO>-<uuid>.jsonl` (date-partitioned
  directory tree, 4 levels deep). Filename pattern confirmed:
  `rollout-<iso-timestamp>-<uuid>.jsonl`.
- Every line is the envelope `{ timestamp, type, payload }` (exactly three top-level
  keys).
- Selection: the `<uuid>` in the filename is the session id; the `session_meta`
  payload also carries `id`, `cwd`, `timestamp`, `cli_version`, and a `git` block
  (`branch`, `commit_hash`, `repository_url`). `session_meta` is how a session is tied
  to a project/cwd. Lineage fields exist: `forked_from_id`, `parent_thread_id`,
  `thread_source`, `source`.

### 2.2 `type` taxonomy (4 envelope types)
`event_msg`, `response_item`, `turn_context`, `session_meta`. In the sample:
`event_msg` and `response_item` dominate; `turn_context` per-turn; `session_meta` a
handful (one+ per session, multiple if forked).

### 2.3 `payload` key taxonomy per type
- `session_meta` payload keys: `id`, `cwd`, `timestamp`, `cli_version`,
  `model_provider`, `originator`, `source`, `thread_source`, `git`,
  `base_instructions`, `agent_nickname`, `agent_role`, `memory_mode`,
  `dynamic_tools`, `multi_agent_version`, `forked_from_id`, `parent_thread_id`.
- `turn_context` payload keys: `cwd`, `model`, `effort`, `summary`,
  `approval_policy`, `sandbox_policy`, `file_system_sandbox_policy`,
  `permission_profile`, `collaboration_mode`, `personality`, `current_date`,
  `timezone`, `user_instructions`, `developer_instructions`, `workspace_roots`,
  `truncation_policy`, `final_output_json_schema`, `realtime_active`, `turn_id`,
  `multi_agent_version`.
- `response_item` payload is polymorphic on its own `type`:
  - `message`: keys `type`, `role`, `content`, `phase`. `role` ∈
    {`user`, `assistant`, `developer`}. `content` is ALWAYS an array of typed parts;
    part types observed: `input_text`, `output_text`.
  - `function_call`: keys `type`, `name`, `arguments`, `call_id`, `namespace`.
  - `function_call_output`: keys `type`, `call_id`, `output`.
  - `reasoning`: keys `type`, `summary`, `content`, `encrypted_content`. In the
    local sample `content` is NULL and only `summary` (array) + `encrypted_content`
    are populated — see completeness note below.
  - `tool_search_call`: keys `type`, `arguments`, `call_id`, `execution`, `status`.
  - `tool_search_output`: keys `type`, `call_id`, `execution`, `status`, `tools`.
- `event_msg` payload is polymorphic on its own `type`:
  - `user_message`: `message`, `images`, `local_images`, `text_elements`, `client_id`.
  - `agent_message`: `message`, `memory_citation`, `phase`.
  - `task_started`: `turn_id`, `started_at`, `model_context_window`,
    `collaboration_mode_kind`.
  - `task_complete`: `turn_id`, `completed_at`, `duration_ms`,
    `time_to_first_token_ms`, `last_agent_message`.
  - `turn_aborted`: `turn_id`, `completed_at`, `duration_ms`, `reason`.
  - `token_count`: `info`, `rate_limits`.
  - `mcp_tool_call_end`: `call_id`, `invocation`, `duration`, `result`.

### 2.4 Codex → normalized category mapping
| Source (type → payload.type)                 | Normalized category |
|----------------------------------------------|---------------------|
| `response_item`/`message` role=user (or `event_msg`/`user_message`) | user_prompt |
| `response_item`/`message` role=assistant (or `event_msg`/`agent_message`) | assistant_message |
| `response_item`/`message` role=developer     | system / instructions |
| `response_item`/`reasoning`                   | assistant_message (reasoning subtype) |
| `response_item`/`function_call`               | tool_call           |
| `response_item`/`function_call_output`        | tool_result         |
| `event_msg`/`mcp_tool_call_end`               | tool_result         |
| `response_item`/`tool_search_call`            | tool_call           |
| `response_item`/`tool_search_output`          | tool_result         |
| `event_msg`/`turn_aborted` (or output marked error) | error          |
| `event_msg`/`task_started`,`task_complete`,`token_count` | verification / summary / control |
| `turn_context`                                | control / context (per-turn settings) |
| `session_meta`                                | summary / session header |
| any unseen variant                            | unknown             |

Note the redundancy: the same user/assistant turn often appears BOTH as a
`response_item`/`message` AND as an `event_msg` (`user_message`/`agent_message`). A
parser must de-duplicate or pick one channel (the `response_item` channel is the
model-facing transcript; `event_msg` is the UI/event stream). command vs
file_operation is not a record distinction — resolve it from the function `name`
inside `function_call`.

### 2.5 Codex variants — confirmed vs NOT confirmed
- CONFIRMED from local files: all four envelope types; the `response_item` variants
  `message`, `function_call`, `function_call_output`, `reasoning`,
  `tool_search_call`, `tool_search_output`; the `event_msg` variants listed in 2.3;
  message content parts `input_text`/`output_text`; `reasoning.content` = null with
  populated `summary`+`encrypted_content`.
- NOT fully confirmed (low/zero local coverage — a parser should treat defensively):
  image/attachment payload sub-shapes (`images`/`local_images` were present as keys
  but their element shape was not exercised); the full shape of `mcp_tool_call_end`
  `result`/`invocation`; `function_call_output` output as string vs structured;
  multi-agent / forked-session payload variants beyond the lineage key names; any
  streaming-delta event types (none observed — local rollouts appear post-aggregated).

---

## 3. Current-session resolution

### Claude Code (reliable vs heuristic)
- Reliable: if the caller already knows the `sessionId`, scan project dirs for the
  file whose records carry that `sessionId` (NOT the filename — they can differ).
- Heuristic (resolve "current session for a cwd"): within the project-slug derived
  from the working directory, pick the `.jsonl` whose records' `cwd` matches the
  target and which has the newest record `timestamp` (or newest file mtime). This is
  a heuristic: concurrent sessions, resumes, and forks in the same cwd can tie or
  mislead. Use record `timestamp`, not just mtime, and confirm `cwd` on actual
  records.

### Codex CLI
- The session id IS the filename `<uuid>`; the date-path gives recency ordering.
- Heuristic for "current session for a cwd": filter `session_meta` payloads by `cwd`,
  then take the newest by the rollout `<ISO>` timestamp (or directory date + file
  mtime). Forked sessions (`forked_from_id`/`parent_thread_id`) mean lineage is not
  strictly linear, so newest-by-timestamp is again a heuristic, not a guarantee.

---

## 4. Completeness limitations (state these plainly)

A "complete session" export claim would be FALSE in these respects:

1. Codex hidden reasoning is NOT recoverable in plaintext. `reasoning.content` is
   null locally; only a `summary` array plus `encrypted_content` exist. The raw model
   reasoning is encrypted and cannot be reconstructed from the local file.
2. Claude `thinking` blocks DO contain plaintext reasoning, but each carries an
   encrypted `signature`. The visible thinking is present; treat it as sensitive.
   Whether every thinking turn is persisted (vs redacted/omitted by the client) is
   not guaranteed across versions.
3. Redundant/dual channels in Codex (`response_item` vs `event_msg`) mean a naive
   union double-counts turns. "Complete" must mean de-duplicated, not all-lines.
4. Tool inputs/outputs may be truncated by the producing client before being written
   (Codex `truncation_policy` exists; Claude large tool results may be elided). The
   file is not a guaranteed byte-faithful copy of everything the model saw.
5. System/hook/compact records (Claude) and `token_count`/rate-limit events (Codex)
   are metadata, not conversation; including them verbatim is not "the conversation".
6. Cross-session continuity (resume/compact in Claude, fork in Codex) means a single
   file may be only part of a logical session, or may begin with a compacted summary
   standing in for earlier turns that are not present in this file.

---

## 5. Edge cases a parser MUST handle

1. Malformed / partial JSON line (truncated final line during a live write) — skip
   the line, do not abort the file.
2. Very large single line (big tool_result, base64 image, long file content) — stream
   / cap memory; do not assume a line fits a small buffer.
3. `content` is string vs array (both Claude user content and Claude
   `tool_result.content`) — branch on the runtime type every time.
4. Unknown top-level `type` (Claude open set) and unknown `payload.type` (Codex
   variants) — map to `unknown`, never crash.
5. Missing `timestamp` (some Claude aux records like `mode`/`ai-title`/`custom-title`
   omit it) — do not key ordering solely on timestamp; fall back to file order/uuid.
6. Filename UUID != internal `sessionId` (Claude) — never assume they match.
7. Unicode / emoji / non-ASCII in any text field — read as UTF-8, set
   `PYTHONIOENCODING=utf-8` for any Python consumer to avoid Windows console errors.
8. Nested arrays inside `tool_result.content` (text/image/tool_reference) and Codex
   message `content` parts (`input_text`/`output_text`) — recurse into typed parts.
9. Duplicate logical turns across Codex `response_item` and `event_msg` channels —
   de-duplicate by `call_id` / `turn_id` where present.
10. `is_error` true on Claude tool_result, and Codex error-bearing outputs /
    `turn_aborted` — classify as error rather than normal output.
11. Empty or content-free files, and files that begin mid-session (compact summary
    first) — handle gracefully.

---

Author: session-format-investigator (subagent)
Date: 2026-06-20
