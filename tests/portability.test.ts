import { describe, it, expect } from 'vitest';
import { toAgentTraceRecord } from '../src/bundle/agenttrace.js';
import { SCHEMA_VERSION, type Category, type NormalizedEvent } from '../src/types/index.js';

function ev(overrides: Partial<NormalizedEvent>): NormalizedEvent {
  return {
    schemaVersion: SCHEMA_VERSION, id: 'e1', sessionId: 's', source: 'claude-code',
    timestamp: '2026-06-20T00:00:00Z', sequence: 1, role: 'assistant', category: 'unknown',
    title: 't', content: 'c', toolName: null, toolCallId: null, command: null, filePath: null,
    status: 'unknown', inferred: false, sourceType: 'x', redactions: [], ...overrides,
  };
}

describe('AgentTrace-native emission', () => {
  it('emits a user prompt as a string-content user record', () => {
    const r = toAgentTraceRecord(ev({ category: 'user_prompt', role: 'user', content: 'hi' }));
    expect(r.type).toBe('user');
    expect((r.message as { content: unknown }).content).toBe('hi');
  });

  it('emits a tool_use block with id, name, and input', () => {
    const r = toAgentTraceRecord(ev({ category: 'command', toolName: 'Bash', toolCallId: 'k1', command: 'npm test' }));
    const block = (r.message as { content: { type: string; id: string; name: string; input: Record<string, unknown> }[] }).content[0];
    expect(block.type).toBe('tool_use');
    expect(block.id).toBe('k1');
    expect(block.name).toBe('Bash');
    expect(block.input.command).toBe('npm test');
  });

  it('emits a tool_result block linked by tool_use_id', () => {
    const r = toAgentTraceRecord(ev({ category: 'tool_result', role: 'tool', toolCallId: 'k1', content: 'output' }));
    const block = (r.message as { content: { type: string; tool_use_id: string; is_error: boolean }[] }).content[0];
    expect(block.type).toBe('tool_result');
    expect(block.tool_use_id).toBe('k1');
    expect(block.is_error).toBe(false);
  });

  it('emits a failing tool result as is_error true', () => {
    const r = toAgentTraceRecord(ev({ category: 'error', role: 'tool', toolCallId: 'k1', sourceType: 'tool_result', status: 'failure' }));
    const block = (r.message as { content: { is_error: boolean }[] }).content[0];
    expect(block.is_error).toBe(true);
  });

  it('emits a plan as an ExitPlanMode tool_use', () => {
    const r = toAgentTraceRecord(ev({ category: 'plan', content: '1. do it' }));
    const block = (r.message as { content: { name: string; input: { plan: string } }[] }).content[0];
    expect(block.name).toBe('ExitPlanMode');
    expect(block.input.plan).toBe('1. do it');
  });

  it('emits a summary record', () => {
    const r = toAgentTraceRecord(ev({ category: 'summary', content: 'title' }));
    expect(r.type).toBe('summary');
    expect(r.summary).toBe('title');
  });

  it('always carries the _sessionporter sidecar', () => {
    const cats: Category[] = ['user_prompt', 'assistant_message', 'command', 'tool_result', 'summary', 'unknown'];
    for (const c of cats) {
      const r = toAgentTraceRecord(ev({ category: c }));
      expect(r._sessionporter).toBeTruthy();
    }
  });
});
