/**
 * Emit session.normalized.jsonl as AgentTrace-native records. AgentTrace
 * re-derives category from raw Claude block shapes (it ignores a flat
 * `category`), so to make its tool-usage / retry / verification analytics work
 * we reconstruct the `message.content[]` envelope with linked tool_use/tool_result
 * ids. Each line also carries a `_sessionporter` sidecar with the full normalized
 * event (AgentTrace keeps it inertly in rawData). See docs/agenttrace-compatibility.md.
 */
import type { NormalizedEvent } from '../types/index.js';

function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

function toolInput(ev: NormalizedEvent): Record<string, unknown> {
  const input = compact({ command: ev.command, file_path: ev.filePath });
  if (Object.keys(input).length === 0 && ev.content) input._detail = ev.content;
  return input;
}

/** One AgentTrace-native record for a normalized event. */
export function toAgentTraceRecord(ev: NormalizedEvent): Record<string, unknown> {
  const sidecar = { _sessionporter: ev };
  const ts = ev.timestamp ?? undefined;
  const id = ev.toolCallId ?? ev.id;

  switch (ev.category) {
    case 'user_prompt':
      return { type: 'user', timestamp: ts, sessionId: ev.sessionId, message: { role: 'user', content: ev.content }, ...sidecar };
    case 'assistant_message':
      return { type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text: ev.content }] }, ...sidecar };
    case 'plan':
      return {
        type: 'assistant', timestamp: ts,
        message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'ExitPlanMode', input: { plan: ev.content } }] },
        ...sidecar,
      };
    case 'tool_call':
    case 'command':
    case 'file_operation':
    case 'verification':
      return {
        type: 'assistant', timestamp: ts,
        message: { role: 'assistant', content: [{ type: 'tool_use', id, name: ev.toolName ?? 'tool', input: toolInput(ev) }] },
        ...sidecar,
      };
    case 'tool_result':
      return {
        type: 'user', timestamp: ts,
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: false, content: ev.content }] },
        ...sidecar,
      };
    case 'error':
      if (ev.sourceType === 'tool_result' || ev.toolCallId) {
        return {
          type: 'user', timestamp: ts,
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: ev.content }] },
          ...sidecar,
        };
      }
      return { type: 'error', timestamp: ts, error: ev.content, ...sidecar };
    case 'summary':
      return { type: 'summary', summary: ev.content, ...sidecar };
    case 'unknown':
    default:
      return { type: ev.sourceType || 'unknown', timestamp: ts, content: ev.content, ...sidecar };
  }
}

export function toAgentTraceJsonl(events: NormalizedEvent[]): string {
  return events.map((ev) => JSON.stringify(toAgentTraceRecord(ev))).join('\n') + '\n';
}

/** The flat normalized events, one per line (SessionPorter's own tool-independent view). */
export function toNormalizedEventsJsonl(events: NormalizedEvent[]): string {
  return events.map((ev) => JSON.stringify(ev)).join('\n') + '\n';
}
