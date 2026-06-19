/** Map Claude Code session records into the normalized event model. */
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

interface Builder {
  seq: number;
  events: NormalizedEvent[];
  warnings: ParseWarning[];
  meta: SessionMeta;
  maxEventChars: number;
}

export function normalizeClaude(
  records: RawRecord[],
  meta: SessionMeta,
  maxEventChars: number,
): NormalizeResult {
  const b: Builder = { seq: 0, events: [], warnings: [], meta, maxEventChars };

  records.forEach((rec, idx) => {
    const line = rec.line ?? idx + 1;
    const v = rec.value;
    if (isObject(v) && typeof v['sessionporter:parseError'] === 'string') {
      b.warnings.push({ message: `Line ${line} is not valid JSON; skipped.`, line, severity: 'warning' });
      return;
    }
    if (!isObject(v)) {
      push(b, line, 0, { category: 'unknown', role: 'unknown', title: 'Unrecognised record', content: safeStringify(v), sourceType: typeof v });
      return;
    }
    recordToEvents(b, v, line);
  });

  b.events.forEach((e, i) => (e.sequence = i + 1));
  return { events: b.events, warnings: b.warnings };
}

function recordToEvents(b: Builder, rec: Json, line: number): void {
  const type = pickString(rec, ['type']) ?? 'unknown';
  const ts = pickString(rec, ['timestamp']) ?? null;

  if (type === 'summary') {
    push(b, line, 0, {
      category: 'summary', role: 'system', title: 'Session title',
      content: flattenContent(rec.summary ?? ''), sourceType: 'summary', timestamp: ts,
    });
    return;
  }

  const message = getObject(rec, 'message');
  const roleStr = (message && pickString(message, ['role'])) ?? pickString(rec, ['role']) ?? type;
  const role = toRole(roleStr);

  if (message) {
    const content = message['content'];
    if (Array.isArray(content)) {
      content.forEach((block, bi) => blockToEvent(b, block, line, bi, role, ts));
      return;
    }
    if (typeof content === 'string') {
      push(b, line, 0, {
        category: role === 'user' ? 'user_prompt' : 'assistant_message', role,
        title: role === 'user' ? 'User message' : 'Assistant message',
        content, sourceType: type, timestamp: ts,
      });
      return;
    }
  }

  // Other record types (system, ai-title, mode, attachment, ...): preserve.
  const text = pickString(rec, ['content', 'text', 'summary', 'title']);
  push(b, line, 0, {
    category: 'unknown', role, title: `${type} record`,
    content: text ?? safeStringify(rec), sourceType: type, timestamp: ts,
  });
}

function blockToEvent(b: Builder, block: unknown, line: number, bi: number, role: Role, ts: string | null): void {
  const blk: Json = isObject(block) ? block : {};
  const btype = pickString(blk, ['type']) ?? 'unknown';

  switch (btype) {
    case 'text':
      push(b, line, bi, {
        category: role === 'user' ? 'user_prompt' : 'assistant_message', role,
        title: role === 'user' ? 'User message' : 'Assistant message',
        content: flattenContent(blk.text), sourceType: 'text', timestamp: ts,
      });
      return;
    case 'thinking':
      push(b, line, bi, {
        category: 'assistant_message', role: 'assistant', title: 'Thinking (model reasoning)',
        content: flattenContent(blk.thinking ?? blk.text), sourceType: 'thinking', timestamp: ts,
      });
      return;
    case 'tool_use': {
      const name = pickString(blk, ['name']) ?? 'tool';
      const input = getObject(blk, 'input');
      const command = input ? pickString(input, ['command', 'cmd']) ?? null : null;
      const filePath = input ? pickString(input, ['file_path', 'filePath', 'path', 'notebook_path']) ?? null : null;
      const plan = input ? pickString(input, ['plan']) ?? null : null;
      let category: Category = 'tool_call';
      let inferred = false;
      if (name === 'ExitPlanMode') category = 'plan';
      else if (isFileTool(name)) category = 'file_operation';
      else if (isCommandTool(name)) {
        if (looksLikeVerification(command)) { category = 'verification'; inferred = true; }
        else category = 'command';
      }
      push(b, line, bi, {
        category, role: 'assistant', title: titleForTool(category, name),
        content: plan ?? command ?? filePath ?? (input ? safeStringify(input) : ''),
        toolName: name, toolCallId: pickString(blk, ['id']) ?? null, command, filePath,
        status: 'unknown', inferred, sourceType: 'tool_use', timestamp: ts,
      });
      return;
    }
    case 'tool_result': {
      const isErr = blk.is_error === true;
      push(b, line, bi, {
        category: isErr ? 'error' : 'tool_result', role: 'tool',
        title: isErr ? 'Tool result (error)' : 'Tool result',
        content: flattenContent(blk.content), toolCallId: pickString(blk, ['tool_use_id']) ?? null,
        status: isErr ? 'failure' : 'success', sourceType: 'tool_result', timestamp: ts,
      });
      return;
    }
    default:
      push(b, line, bi, {
        category: 'unknown', role, title: `${btype} block`,
        content: flattenContent(blk.text ?? blk.content ?? `[${btype}]`),
        sourceType: btype, timestamp: ts,
      });
  }
}

function titleForTool(category: Category, name: string): string {
  if (category === 'plan') return 'Plan';
  if (category === 'verification') return 'Verification';
  if (category === 'command') return 'Command';
  if (category === 'file_operation') return `File op: ${name}`;
  return `Tool: ${name}`;
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

function push(b: Builder, line: number, blockIdx: number, p: PartialEvent): void {
  const { text, truncated } = truncate(p.content, b.maxEventChars);
  if (truncated) {
    b.warnings.push({ message: `Event at line ${line} block ${blockIdx} content truncated to ${b.maxEventChars} characters.`, line, severity: 'warning' });
  }
  b.events.push({
    schemaVersion: SCHEMA_VERSION,
    id: `claude-${line}-${blockIdx}`,
    sessionId: b.meta.sessionId,
    source: 'claude-code',
    timestamp: p.timestamp ?? null,
    sequence: ++b.seq,
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
}
