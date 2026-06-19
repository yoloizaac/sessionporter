import { describe, it, expect, beforeAll } from 'vitest';
import { createClaudeAdapter } from '../src/adapters/claude/index.js';
import { createCodexAdapter } from '../src/adapters/codex/index.js';
import { normalizeManual, detectManualFormat } from '../src/adapters/manual/normalize.js';
import { DEFAULT_LIMITS, type NormalizedEvent, type RawRecord, type SessionMeta } from '../src/types/index.js';
import { useFixtureSources, CLAUDE_SESSION_ID } from './helpers.js';
import { readFile } from 'node:fs/promises';
import { MANUAL_TRANSCRIPT } from './helpers.js';

beforeAll(() => useFixtureSources());

async function loadVia(adapter: ReturnType<typeof createClaudeAdapter>, meta: SessionMeta) {
  const records: RawRecord[] = [];
  for await (const r of adapter.readRecords(meta, DEFAULT_LIMITS)) records.push(r);
  return adapter.normalize(records, meta, DEFAULT_LIMITS);
}

describe('Claude normalization', () => {
  let events: NormalizedEvent[];
  let warnings: { message: string }[];
  beforeAll(async () => {
    const adapter = createClaudeAdapter();
    const meta = await adapter.getSession(CLAUDE_SESSION_ID);
    expect(meta).not.toBeNull();
    const r = await loadVia(adapter, meta!);
    events = r.events;
    warnings = r.warnings;
  });

  it('produces the expected categories', () => {
    const cats = new Set(events.map((e) => e.category));
    for (const c of ['user_prompt', 'assistant_message', 'command', 'file_operation', 'verification', 'error', 'summary', 'unknown']) {
      expect(cats.has(c as NormalizedEvent['category'])).toBe(true);
    }
  });
  it('warns on the malformed line and still parses the rest', () => {
    expect(warnings.some((w) => /not valid JSON/i.test(w.message))).toBe(true);
    expect(events.length).toBeGreaterThan(10);
  });
  it('labels verification as inferred and detects npm test', () => {
    const verif = events.filter((e) => e.category === 'verification');
    expect(verif.length).toBeGreaterThanOrEqual(1);
    expect(verif.every((e) => e.inferred)).toBe(true);
    expect(verif.some((e) => e.command === 'npm test')).toBe(true);
  });
  it('links tool_use ids to tool_result ids', () => {
    const call = events.find((e) => e.toolName === 'Read');
    const result = events.find((e) => e.category === 'tool_result' && e.toolCallId === 't1');
    expect(call?.toolCallId).toBe('t1');
    expect(result).toBeTruthy();
  });
  it('keeps an error result and marks failure', () => {
    const err = events.find((e) => e.category === 'error');
    expect(err?.status).toBe('failure');
  });
  it('never fabricates a timestamp', () => {
    const noTs = events.find((e) => e.content.includes('日本語'));
    expect(noTs?.timestamp).toBeNull();
  });
  it('preserves an unknown record type', () => {
    const unknown = events.find((e) => e.sourceType === 'telemetry');
    expect(unknown?.category).toBe('unknown');
  });
  it('assigns stable, unique sequence and ids', () => {
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(events.map((e) => e.sequence)).toEqual(events.map((_, i) => i + 1));
  });
});

describe('Codex normalization (experimental)', () => {
  let events: NormalizedEvent[];
  let warnings: { message: string }[];
  beforeAll(async () => {
    const adapter = createCodexAdapter();
    const meta = await adapter.getSession('019eaaaa-0000-7000-8000-000000000001');
    expect(meta).not.toBeNull();
    const records: RawRecord[] = [];
    for await (const r of adapter.readRecords(meta!, DEFAULT_LIMITS)) records.push(r);
    const out = adapter.normalize(records, meta!, DEFAULT_LIMITS);
    events = out.events;
    warnings = out.warnings;
  });

  it('skips event_msg duplicates and session_meta/turn_context', () => {
    // 9 records: session_meta, turn_context, user msg, assistant msg, shell call, event_msg (skip),
    // call_output, reasoning, assistant msg -> 6 events.
    expect(events.length).toBe(6);
  });
  it('maps a local_shell_call to a command and detects verification', () => {
    const cmd = events.find((e) => e.command === 'npm test');
    expect(cmd).toBeTruthy();
    expect(cmd?.category).toBe('verification');
  });
  it('maps a failing function_call_output to an error', () => {
    const err = events.find((e) => e.category === 'error');
    expect(err?.status).toBe('failure');
  });
  it('does not expose encrypted reasoning content', () => {
    const reasoning = events.find((e) => e.sourceType === 'codex:reasoning');
    expect(reasoning?.content).toContain('Planning the fix');
    expect(reasoning?.content).not.toContain('ENCRYPTED-BLOB');
  });
  it('warns that Codex support is experimental', () => {
    expect(warnings.some((w) => /EXPERIMENTAL/i.test(w.message))).toBe(true);
  });
});

describe('Manual import', () => {
  it('infers roles from Markdown headings and labels them inferred', async () => {
    const text = await readFile(MANUAL_TRANSCRIPT, 'utf8');
    const fmt = detectManualFormat('transcript.md', text);
    expect(fmt).toBe('markdown');
    const { events } = normalizeManual(text, fmt, 'manualhash', DEFAULT_LIMITS.maxEventChars);
    expect(events.some((e) => e.category === 'user_prompt')).toBe(true);
    expect(events.some((e) => e.category === 'assistant_message')).toBe(true);
    expect(events.every((e) => e.inferred)).toBe(true);
  });
});
