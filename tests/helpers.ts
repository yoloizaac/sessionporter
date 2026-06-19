import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, type SessionPorterConfig } from '../src/types/index.js';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..');
export const FIXTURES = join(REPO_ROOT, 'fixtures');
export const CLAUDE_FIXTURES = join(FIXTURES, 'claude');
export const CODEX_FIXTURES = join(FIXTURES, 'codex');
export const MANUAL_TRANSCRIPT = join(FIXTURES, 'manual', 'transcript.md');

/** Point the adapters at the synthetic fixtures for this process. */
export function useFixtureSources(): void {
  process.env.SESSIONPORTER_CLAUDE_PROJECTS = CLAUDE_FIXTURES;
  process.env.SESSIONPORTER_CODEX_SESSIONS = CODEX_FIXTURES;
}

export async function tempExportRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'sp-test-'));
}

export function testConfig(overrides: Partial<SessionPorterConfig> = {}): SessionPorterConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export const CLAUDE_SESSION_ID = 'sess-basic-0001';
export const CLAUDE_CWD = '/home/devuser/demo-project';
