import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createClaudeAdapter } from '../src/adapters/claude/index.js';
import { useFixtureSources, CLAUDE_FIXTURES, CLAUDE_SESSION_ID, CLAUDE_CWD } from './helpers.js';

describe('Claude discovery', () => {
  beforeAll(() => useFixtureSources());

  it('lists multiple sessions across project slugs', async () => {
    const adapter = createClaudeAdapter();
    const sessions = await adapter.discover({ limit: 25 });
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('reads metadata (project, cwd, record count) for a session', async () => {
    const adapter = createClaudeAdapter();
    const meta = await adapter.getSession(CLAUDE_SESSION_ID);
    expect(meta).not.toBeNull();
    expect(meta!.project).toBe('demo-project');
    expect(meta!.cwd).toBe(CLAUDE_CWD);
    expect(meta!.recordCount).toBeGreaterThan(10);
    expect(meta!.title).toBe('Add CSV export to demo-project');
  });

  it('counts an empty session as zero records', async () => {
    const adapter = createClaudeAdapter();
    const sessions = await adapter.discover({ limit: 25 });
    const empty = sessions.find((s) => s.recordCount === 0);
    expect(empty).toBeTruthy();
  });

  it('resolves the current session heuristically and says so', async () => {
    const adapter = createClaudeAdapter();
    const r = await adapter.resolveCurrent(CLAUDE_CWD);
    expect(r).not.toBeNull();
    expect(r!.meta.cwd).toBe(CLAUDE_CWD);
    expect(r!.how).toMatch(/heuristic/i);
  });

  it('returns nothing when no current session matches a directory', async () => {
    const adapter = createClaudeAdapter();
    const r = await adapter.resolveCurrent('/no/such/place');
    expect(r).toBeNull();
  });
});

describe('Claude discovery with no session directory', () => {
  const original = process.env.SESSIONPORTER_CLAUDE_PROJECTS;
  beforeAll(() => {
    process.env.SESSIONPORTER_CLAUDE_PROJECTS = join(CLAUDE_FIXTURES, 'does-not-exist');
  });
  afterAll(() => {
    process.env.SESSIONPORTER_CLAUDE_PROJECTS = original;
  });

  it('reports unavailable and discovers nothing', async () => {
    const adapter = createClaudeAdapter();
    expect(await adapter.isAvailable()).toBe(false);
    expect(await adapter.discover({})).toEqual([]);
  });
});
