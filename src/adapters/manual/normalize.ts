/** Manual transcript importer: accept JSONL / JSON / Markdown / plain text and
 * produce the same normalized model, conservatively. Roles are inferred and
 * labelled; tool metadata is usually absent and is not invented. */
import type {
  Category,
  NormalizeResult,
  NormalizedEvent,
  ParseWarning,
  Role,
} from '../../types/index.js';
import { SCHEMA_VERSION } from '../../types/index.js';
import { flattenContent, isObject, pickString, safeStringify, truncate } from '../../normalize/shared.js';

export type ManualFormat = 'jsonl' | 'json' | 'markdown' | 'text';

export function detectManualFormat(fileName: string, text: string): ManualFormat {
  const lower = fileName.toLowerCase();
  const t = text.trim();
  if (lower.endsWith('.jsonl')) return 'jsonl';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.txt')) return 'text';
  if (t.startsWith('[') || t.startsWith('{')) {
    // could be json or jsonl
    try {
      JSON.parse(t);
      return 'json';
    } catch {
      return 'jsonl';
    }
  }
  return 'text';
}

export function normalizeManual(
  text: string,
  format: ManualFormat,
  sessionId: string,
  maxEventChars: number,
): NormalizeResult {
  const events: NormalizedEvent[] = [];
  const warnings: ParseWarning[] = [];

  const add = (role: Role, category: Category, title: string, content: string, inferred: boolean, sourceType: string): void => {
    const { text: body, truncated } = truncate(content, maxEventChars);
    if (truncated) warnings.push({ message: `Imported event ${events.length + 1} truncated.`, severity: 'warning' });
    events.push({
      schemaVersion: SCHEMA_VERSION,
      id: `manual-${events.length + 1}`,
      sessionId,
      source: 'manual',
      timestamp: null,
      sequence: events.length + 1,
      role,
      category,
      title,
      content: body,
      toolName: null,
      toolCallId: null,
      command: null,
      filePath: null,
      status: 'unknown',
      inferred,
      sourceType,
      redactions: [],
    });
  };

  if (format === 'jsonl' || format === 'json') {
    const records = format === 'json' ? jsonRecords(text, warnings) : jsonlRecords(text, warnings);
    for (const rec of records) {
      if (!isObject(rec)) {
        add('unknown', 'unknown', 'Imported record', safeStringify(rec), true, typeof rec);
        continue;
      }
      const roleStr = pickString(rec, ['role', 'sender', 'author', 'type']);
      const role = toRole(roleStr);
      const content = pickString(rec, ['content', 'text', 'message', 'body']) ?? flattenContent(rec['content']) ?? safeStringify(rec);
      const category: Category = role === 'user' ? 'user_prompt' : role === 'assistant' ? 'assistant_message' : 'unknown';
      add(role, category, titleForRole(role), content, true, roleStr ?? 'record');
    }
    warnings.push({ message: 'Manual import: tool calls, file operations, and outcomes may be incomplete because they are not present in a generic transcript.', severity: 'warning' });
    return { events, warnings };
  }

  // Markdown / text: split on simple role markers when present, else one note.
  const segments = splitByRoleMarkers(text);
  if (segments.length === 0) {
    add('unknown', 'unknown', 'Imported transcript', text, true, format);
  } else {
    for (const seg of segments) {
      const role = toRole(seg.role);
      const category: Category = role === 'user' ? 'user_prompt' : role === 'assistant' ? 'assistant_message' : 'unknown';
      add(role, category, titleForRole(role), seg.body, true, `${format}:${seg.role ?? 'block'}`);
    }
  }
  warnings.push({ message: 'Manual import from Markdown/text: roles are inferred from headings and may be wrong; tool metadata is not available.', severity: 'warning' });
  return { events, warnings };
}

function jsonlRecords(text: string, warnings: ParseWarning[]): unknown[] {
  const out: unknown[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    try {
      out.push(JSON.parse(t));
    } catch {
      warnings.push({ message: `Line ${i + 1} is not valid JSON; skipped.`, line: i + 1, severity: 'warning' });
    }
  });
  return out;
}

function jsonRecords(text: string, warnings: ParseWarning[]): unknown[] {
  try {
    const v: unknown = JSON.parse(text);
    if (Array.isArray(v)) return v;
    if (isObject(v)) {
      for (const key of ['messages', 'events', 'records', 'conversation']) {
        const arr = v[key];
        if (Array.isArray(arr)) return arr;
      }
      return [v];
    }
  } catch {
    warnings.push({ message: 'Input looked like JSON but could not be parsed; treated as empty.', severity: 'error' });
  }
  return [];
}

interface Segment {
  role: string | undefined;
  body: string;
}

function splitByRoleMarkers(text: string): Segment[] {
  const lines = text.split(/\r?\n/);
  const marker = /^(?:#{1,6}\s*|\*\*\s*)?(user|assistant|human|ai|system|tool)\b\s*:?\s*\**\s*$/i;
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (const line of lines) {
    const m = line.match(marker);
    if (m) {
      if (current) segments.push(current);
      current = { role: m[1], body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) segments.push(current);
  return segments.filter((s) => s.body.trim().length > 0);
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

function titleForRole(role: Role): string {
  switch (role) {
    case 'user':
      return 'User message';
    case 'assistant':
      return 'Assistant message';
    case 'system':
      return 'System message';
    default:
      return 'Message';
  }
}
