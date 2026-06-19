import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exportSession, importTranscript } from '../src/core/engine.js';
import { validateBundle } from '../src/validate/validate.js';
import { readZip } from '../src/bundle/zip.js';
import { SessionPorterError } from '../src/core/errors.js';
import {
  useFixtureSources, tempExportRoot, testConfig, CLAUDE_SESSION_ID, CLAUDE_CWD, MANUAL_TRANSCRIPT,
} from './helpers.js';

beforeAll(() => useFixtureSources());

const baseOpts = {
  source: 'claude-code' as const,
  sessionId: CLAUDE_SESSION_ID,
  cwd: CLAUDE_CWD,
  config: testConfig({ redactTerms: ['demo-project'] }),
  makeZip: true,
  allowSecrets: false,
};

describe('sanitized export', () => {
  let dir: string;
  let normalized: string;
  let transcript: string;
  beforeAll(async () => {
    const out = await tempExportRoot();
    const r = await exportSession({
      ...baseOpts, mode: 'sanitized', includeRaw: false, exportRoot: out, exportedAt: '2026-06-20T10-00-00.000Z',
    });
    dir = r.bundleDir;
    normalized = await readFile(r.files.normalized, 'utf8');
    transcript = await readFile(r.files.transcript, 'utf8');
  });

  it('validates and contains the required files', async () => {
    const v = await validateBundle(dir);
    expect(v.ok).toBe(true);
    const files = await readdir(dir);
    for (const f of ['session.normalized.jsonl', 'session.transcript.md', 'session.summary.md', 'manifest.json', 'REDACTION_REPORT.md', 'README.md', 'checksums.sha256']) {
      expect(files).toContain(f);
    }
  });
  it('omits raw logs in sanitized mode', async () => {
    const files = await readdir(dir);
    expect(files).not.toContain('session.raw.jsonl');
  });
  it('redacts credentials, emails, and home paths everywhere', () => {
    for (const blob of [normalized, transcript]) {
      expect(blob).not.toContain('FAKEKEY');
      expect(blob).not.toContain('secretpass');
      expect(blob).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(blob).not.toContain('devuser@example.com');
      expect(blob).not.toContain('/home/devuser');
    }
    expect(transcript).toContain('[REDACTED_API_KEY]');
  });
  it('emits AgentTrace-native records with linked tool ids', () => {
    const lines = normalized.trim().split('\n').map((l) => JSON.parse(l));
    const toolUse = lines.find((r) => r.message?.content?.[0]?.type === 'tool_use');
    const toolResult = lines.find((r) => r.message?.content?.[0]?.type === 'tool_result');
    expect(toolUse).toBeTruthy();
    expect(toolResult).toBeTruthy();
    expect(lines.every((r) => r._sessionporter)).toBe(true);
    expect(lines.some((r) => r.type === 'summary')).toBe(true);
  });
  it('redaction report never reveals an original value', async () => {
    const report = await readFile(join(dir, 'REDACTION_REPORT.md'), 'utf8');
    expect(report).not.toContain('FAKEKEY');
    expect(report).not.toContain('secretpass');
    expect(report).toMatch(/api_key/);
  });
  it('checksums.sha256 does not list itself and matches', async () => {
    const body = await readFile(join(dir, 'checksums.sha256'), 'utf8');
    expect(body).not.toMatch(/checksums\.sha256/);
    const v = await validateBundle(dir);
    expect(v.errors).toEqual([]);
  });
});

describe('zip integrity', () => {
  it('zip entries match the written files', async () => {
    const out = await tempExportRoot();
    const r = await exportSession({
      ...baseOpts, mode: 'sanitized', includeRaw: false, exportRoot: out, exportedAt: '2026-06-20T11-00-00.000Z',
    });
    expect(r.zipPath).toBeTruthy();
    const zipBuf = await readFile(r.zipPath!);
    const entries = readZip(zipBuf);
    for (const e of entries) {
      const onDisk = await readFile(join(r.bundleDir, e.name), 'utf8');
      expect(e.data.toString('utf8')).toBe(onDisk);
    }
    expect(entries.some((e) => e.name === 'session.normalized.jsonl')).toBe(true);
  });
});

describe('private export', () => {
  it('includes raw logs and keeps emails, but still blocks credentials', async () => {
    const out = await tempExportRoot();
    const r = await exportSession({
      ...baseOpts, mode: 'private', includeRaw: true, exportRoot: out, exportedAt: '2026-06-20T12-00-00.000Z',
    });
    const files = await readdir(r.bundleDir);
    expect(files).toContain('session.raw.jsonl');
    const transcript = await readFile(r.files.transcript, 'utf8');
    expect(transcript).toContain('devuser@example.com'); // private keeps emails
    expect(transcript).not.toContain('FAKEKEY'); // credentials still blocked
  });
});

describe('overwrite protection', () => {
  it('refuses to overwrite an existing export', async () => {
    const out = await tempExportRoot();
    const opts = { ...baseOpts, mode: 'sanitized' as const, includeRaw: false, exportRoot: out, exportedAt: '2026-06-20T13-00-00.000Z' };
    await exportSession(opts);
    await expect(exportSession(opts)).rejects.toThrow(SessionPorterError);
  });
});

describe('manual import bundle', () => {
  it('produces a valid bundle from a Markdown transcript', async () => {
    const out = await tempExportRoot();
    const r = await importTranscript({
      filePath: MANUAL_TRANSCRIPT, cwd: process.cwd(), mode: 'sanitized',
      config: testConfig(), exportRoot: out, exportedAt: '2026-06-20T14-00-00.000Z', makeZip: false,
    });
    const v = await validateBundle(r.bundleDir);
    expect(v.ok).toBe(true);
    const transcript = await readFile(r.files.transcript, 'utf8');
    expect(transcript).not.toContain('FAKEKEY');
  });
});
