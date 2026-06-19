/** EXPERIMENTAL Codex adapter normalize. Maps the codex-cli rollout format
 * (`{timestamp,type,payload}`) into the normalized model. Tested against a
 * synthetic fixture modelling the observed structure; real payload variants may
 * differ across Codex versions, so unknown shapes are preserved as `unknown`.
 *
 * Known limitation: Codex stores model reasoning encrypted; it is NOT recoverable. */
import type {
  Category,
  NormalizeResult,
  NormalizedEvent,
  ParseWarning,
  RawRecord,
  Role,
  SessionMeta,
  Status,
} from '../../types/index.js';
import { SCHEMA_VERSION } from '../../types/index.js';
import {
  flattenContent,
  getObject,
  isCommandTool,
  isFileTool,
  isObject,
  looksLikeVerification,
  pickString,
  safeStringify,
  truncate,
  type Json,
} from '../../normalize/shared.js';

export function normalizeCodex(records: RawRecord[], meta: SessionMeta, maxEventChars: number): NormalizeResult {
  const events: NormalizedEvent[] = [];
  const warnings: ParseWarning[] = [];
  let seq = 0;

  const add = (line: number, p: PartialEvent): void => {
    const { text, truncated } = truncate(p.content, maxEventChars);
    if (truncated) warnings.push({ message: `Codex event at line ${line} truncated.`, line, severity: 'warning' });
    events.push({
      schemaVersion: SCHEMA_VERSION,
      id: `codex-${line}`,
      sessionId: meta.sessionId,
      source: 'codex',
      timestamp: p.timestamp ?? null,
      sequence: ++seq,
      role: p.role,
      category: p.category,
      title: p.title,
      content: text,
      toolName: p.toolName ?? null,
      toolCallId: p.toolCallId ?? null,
      command: p.command ?? null,
      filePath: p.filePath ?? null,
      status: p.status ?? (p.category === 'error' ? 'failure' : 'unknown'),
      inferred: p.inferred ?? false,
      sourceType: p.sourceType,
      redactions: [],
    });
  };

  records.forEach((rec, idx) => {
    const line = rec.line ?? idx + 1;
    const v = rec.value;
    if (isObject(v) && typeof v['sessionporter:parseError'] === 'string') {
      warnings.push({ message: `Line ${line} is not valid JSON; skipped.`, line, severity: 'warning' });
      return;
    }
    if (!isObject(v)) return;
    const type = pickString(v, ['type']) ?? 'unknown';
    const ts = pickString(v, ['timestamp']) ?? null;
    const payload = getObject(v, 'payload');

    // event_msg duplicates response_item; skip to avoid double counting.
    if (type === 'event_msg' || type === 'turn_context' || type === 'session_meta') return;
    if (type !== 'response_item' || !payload) return;

    const pType = pickString(payload, ['type']) ?? 'unknown';
    switch (pType) {
      case 'message': {
        const role = toRole(pickString(payload, ['role']));
        add(line, {
          category: role === 'user' ? 'user_prompt' : 'assistant_message', role,
          title: role === 'user' ? 'User message' : 'Assistant message',
          content: flattenContent(payload['content']), sourceType: 'codex:message', timestamp: ts,
        });
        return;
      }
      case 'reasoning':
        add(line, {
          category: 'assistant_message', role: 'assistant', title: 'Reasoning (summary)',
          content: codexReasoning(payload), sourceType: 'codex:reasoning', timestamp: ts, inferred: true,
        });
        return;
      case 'function_call':
      case 'local_shell_call': {
        const name = pickString(payload, ['name']) ?? (pType === 'local_shell_call' ? 'local_shell' : 'tool');
        const command = codexCommand(payload);
        let category: Category = 'tool_call';
        let inferred = false;
        if (isFileTool(name)) category = 'file_operation';
        else if (isCommandTool(name) || pType === 'local_shell_call') {
          if (looksLikeVerification(command)) { category = 'verification'; inferred = true; }
          else category = 'command';
        }
        add(line, {
          category, role: 'assistant', title: category === 'command' ? 'Command' : `Tool: ${name}`,
          content: command ?? pickString(payload, ['arguments']) ?? safeStringify(payload),
          toolName: name, toolCallId: pickString(payload, ['call_id', 'id']) ?? null,
          command, status: 'unknown', inferred, sourceType: `codex:${pType}`, timestamp: ts,
        });
        return;
      }
      case 'function_call_output':
      case 'local_shell_call_output': {
        const { content, status } = codexOutput(payload);
        add(line, {
          category: status === 'failure' ? 'error' : 'tool_result', role: 'tool',
          title: status === 'failure' ? 'Tool result (error)' : 'Tool result',
          content, toolCallId: pickString(payload, ['call_id', 'id']) ?? null, status,
          sourceType: `codex:${pType}`, timestamp: ts,
        });
        return;
      }
      default:
        add(line, {
          category: 'unknown', role: 'unknown', title: `${pType} record`,
          content: flattenContent(payload['content'] ?? payload['text'] ?? `[${pType}]`),
          sourceType: `codex:${pType}`, timestamp: ts,
        });
    }
  });

  warnings.push({ message: 'Codex support is EXPERIMENTAL. Model reasoning is stored encrypted by Codex and is not recoverable; the dual event channels are de-duplicated heuristically.', severity: 'warning' });
  return { events, warnings };
}

function codexReasoning(payload: Json): string {
  const summary = flattenContent(payload['summary']);
  if (summary && summary.trim().length > 0) return summary;
  return '[reasoning stored encrypted by Codex; not recoverable]';
}

function codexCommand(payload: Json): string | null {
  const action = getObject(payload, 'action');
  if (action && Array.isArray(action['command'])) {
    return (action['command'] as unknown[]).map((c) => String(c)).join(' ');
  }
  if (Array.isArray(payload['command'])) {
    return (payload['command'] as unknown[]).map((c) => String(c)).join(' ');
  }
  return pickString(payload, ['command']) ?? null;
}

function codexOutput(payload: Json): { content: string; status: Status } {
  const output = payload['output'];
  let status: Status = 'unknown';
  if (isObject(output)) {
    const meta = getObject(output, 'metadata');
    const exit = meta?.['exit_code'];
    if (typeof exit === 'number') status = exit === 0 ? 'success' : 'failure';
    return { content: flattenContent(output['output'] ?? output), status };
  }
  return { content: flattenContent(output), status };
}

interface PartialEvent {
  category: Category;
  role: Role;
  title: string;
  content: string;
  sourceType: string;
  timestamp?: string | null;
  toolName?: string | null;
  toolCallId?: string | null;
  command?: string | null;
  filePath?: string | null;
  status?: Status;
  inferred?: boolean;
}

function toRole(value: string | undefined): Role {
  if (!value) return 'unknown';
  const r = value.toLowerCase();
  if (r === 'human' || r.includes('user')) return 'user';
  if (r === 'ai' || r === 'model' || r.includes('assistant')) return 'assistant';
  if (r.includes('system')) return 'system';
  if (r.includes('tool')) return 'tool';
  return 'unknown';
}
