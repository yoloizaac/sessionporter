#!/usr/bin/env node
/** SessionPorter CLI. All discovery, selection, redaction, bundling, and
 * validation live below the engine; this file is argument parsing, prompts, and
 * output formatting only. */
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { ExportMode, SourceId, SessionMeta } from '../types/index.js';
import { loadConfig } from '../core/config.js';
import { getAdapter, availableAdapters } from '../discovery/index.js';
import {
  exportSession,
  importTranscript,
  redactPreview,
  resolveSession,
  type ExportResult,
} from '../core/engine.js';
import { validateBundle } from '../validate/validate.js';
import { SessionPorterError, errorCode, errorMessage } from '../core/errors.js';
import { printJsonOk, printJsonError, human, humanErr, exitCodeFor } from './output.js';

interface Parsed {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  const command = argv[0] ?? 'help';
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positionals.push(a);
    }
  }
  return { command, positionals, flags };
}

function normalizeSource(s: string | boolean | undefined): SourceId {
  const v = typeof s === 'string' ? s.toLowerCase() : 'claude-code';
  if (v === 'claude' || v === 'claude-code') return 'claude-code';
  if (v === 'codex') return 'codex';
  if (v === 'manual') return 'manual';
  throw new SessionPorterError('UNSUPPORTED_SOURCE', `Unknown source "${String(s)}". Use claude, codex, or manual.`);
}

function flagStr(flags: Parsed['flags'], key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

function maskSession(m: SessionMeta): Record<string, unknown> {
  // Never leak the absolute file path in default output.
  return {
    source: m.source,
    safeSessionId: m.safeSessionId,
    title: m.title,
    project: m.project,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    recordCount: m.recordCount,
  };
}

async function ask(rl: ReturnType<typeof createInterface>, q: string): Promise<string> {
  return (await rl.question(q)).trim();
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const json = parsed.flags.json === true || parsed.flags.json === 'true';
  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  const exportRoot = flagStr(parsed.flags, 'out')
    ? resolve(cwd, flagStr(parsed.flags, 'out') as string)
    : join(cwd, '.sessionporter', 'exports');

  try {
    switch (parsed.command) {
      case 'discover':
      case 'list':
        await cmdDiscover(parsed, json, cwd);
        break;
      case 'inspect':
        await cmdInspect(parsed, json, cwd);
        break;
      case 'redact-preview':
        await cmdRedactPreview(parsed, json, cwd, config);
        break;
      case 'export':
        await cmdExport(parsed, json, cwd, config, exportRoot);
        break;
      case 'import-transcript':
        await cmdImport(parsed, json, cwd, config, exportRoot);
        break;
      case 'validate':
        await cmdValidate(parsed, json);
        break;
      case 'help':
      default:
        printHelp();
    }
  } catch (err) {
    const code = errorCode(err);
    if (json) printJsonError(parsed.command, err);
    else humanErr(`Error [${code}]: ${errorMessage(err)}`);
    process.exitCode = exitCodeFor(code);
  }
}

async function cmdDiscover(parsed: Parsed, json: boolean, cwd: string): Promise<void> {
  const recentDays = flagStr(parsed.flags, 'recent') ? Number(flagStr(parsed.flags, 'recent')) : undefined;
  const query = flagStr(parsed.flags, 'query');
  const limit = flagStr(parsed.flags, 'limit') ? Number(flagStr(parsed.flags, 'limit')) : 25;
  const here = parsed.flags.here === true;
  const sourceFilter = parsed.flags.source ? normalizeSource(parsed.flags.source) : null;

  const adapters = (await availableAdapters()).filter((a) => !sourceFilter || a.id === sourceFilter);
  const out: { source: SourceId; sessions: Record<string, unknown>[] }[] = [];
  for (const a of adapters) {
    const sessions = await a.discover({ recentDays, query, limit, cwd: here ? cwd : undefined });
    out.push({ source: a.id, sessions: sessions.map(maskSession) });
  }

  if (json) {
    printJsonOk('discover', { sources: out });
    return;
  }
  if (out.every((s) => s.sessions.length === 0)) {
    human('No sessions found in the available local sources.');
    return;
  }
  for (const grp of out) {
    human(`\n=== ${grp.source} ===`);
    grp.sessions.forEach((s, i) => {
      human(`${i + 1}. ${String(s.startedAt ?? '?')}  ${String(s.title ?? s.project ?? '(untitled)')}`);
      human(`   id: ${String(s.safeSessionId)}  events: ${String(s.recordCount)}`);
    });
  }
}

async function cmdInspect(parsed: Parsed, json: boolean, cwd: string): Promise<void> {
  const source = normalizeSource(parsed.flags.source);
  const { meta, how } = await resolveSession(source, {
    sessionId: flagStr(parsed.flags, 'session'),
    current: parsed.flags.current === true,
    cwd,
  });
  const adapter = getAdapter(source);
  if (!adapter) throw new SessionPorterError('NO_ADAPTER', `No adapter for ${source}.`);
  const data = { session: maskSession(meta), resolvedBy: how };
  if (json) printJsonOk('inspect', data);
  else {
    human(`Session ${meta.safeSessionId} (${source})`);
    human(`  Title: ${meta.title ?? '(none)'}`);
    human(`  Project: ${meta.project ?? '(unknown)'}`);
    human(`  Records: ${meta.recordCount}`);
    if (how) human(`  Resolved by: ${how}`);
  }
}

async function cmdRedactPreview(parsed: Parsed, json: boolean, cwd: string, config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  const source = normalizeSource(parsed.flags.source);
  const mode = (flagStr(parsed.flags, 'mode') as ExportMode) === 'private' ? 'private' : 'sanitized';
  const preview = await redactPreview({
    source,
    sessionId: flagStr(parsed.flags, 'session'),
    current: parsed.flags.current === true,
    cwd,
    mode,
    config,
  });
  const data = {
    session: maskSession(preview.meta),
    mode,
    redactionCounts: preview.redaction.byCategory,
    totalRedactions: preview.redaction.total,
    stats: preview.stats,
  };
  if (json) printJsonOk('redact-preview', data);
  else {
    human(`Redaction preview for ${preview.meta.safeSessionId} (mode: ${mode})`);
    const entries = Object.entries(preview.redaction.byCategory);
    if (entries.length === 0) human('  No likely sensitive values detected.');
    else for (const [c, n] of entries) human(`  ${c}: ${n}`);
    human(`  Total: ${preview.redaction.total}`);
  }
}

async function cmdExport(parsed: Parsed, json: boolean, cwd: string, config: Awaited<ReturnType<typeof loadConfig>>, exportRoot: string): Promise<void> {
  const source = normalizeSource(parsed.flags.source);
  let mode: ExportMode = (flagStr(parsed.flags, 'mode') as ExportMode) === 'private' ? 'private' : 'sanitized';
  const wantPrivate = (flagStr(parsed.flags, 'mode') as ExportMode) === 'private';
  const interactive = process.stdin.isTTY && !json && parsed.flags.yes !== true;
  const exportedAt = new Date().toISOString();

  let sessionId = flagStr(parsed.flags, 'session');
  const current = parsed.flags.current === true;

  // Interactive session pick when neither --session nor --current given.
  if (interactive && !sessionId && !current) {
    sessionId = await pickSessionInteractive(source, cwd);
  }

  // Resolve + preview.
  const preview = await redactPreview({ source, sessionId, current, cwd, mode, config });

  if (!json) {
    human(`\nSelected ${source} session: ${preview.meta.title ?? preview.meta.project ?? preview.meta.safeSessionId}`);
    if (preview.how) human(`(resolved: ${preview.how})`);
    human('\nPotential sensitive values detected:');
    const entries = Object.entries(preview.redaction.byCategory);
    if (entries.length === 0) human('  none');
    else for (const [c, n] of entries) human(`  ${n} ${c}`);
  }

  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!wantPrivate) {
        const m = await ask(rl, '\nExport mode [S]anitized (recommended) / [p]rivate: ');
        mode = m.toLowerCase().startsWith('p') ? 'private' : 'sanitized';
      }
      if (mode === 'private') {
        const confirm = await ask(rl, 'Private mode keeps more original content and may include secrets in tool outputs.\nType exactly "CONFIRM PRIVATE" to continue: ');
        if (confirm !== 'CONFIRM PRIVATE') throw new SessionPorterError('PRIVATE_NOT_CONFIRMED', 'Private export not confirmed.');
      }
      const go = await ask(rl, `\nContinue with ${mode} export? [Y/n]: `);
      if (go.toLowerCase().startsWith('n')) {
        human('Cancelled.');
        return;
      }
    } finally {
      rl.close();
    }
  } else if (mode === 'private' && parsed.flags['confirm-private'] !== true) {
    throw new SessionPorterError('PRIVATE_NOT_CONFIRMED', 'Private export requires --confirm-private in non-interactive mode.');
  }

  const result = await exportSession({
    source,
    sessionId,
    current,
    cwd,
    mode,
    config,
    exportRoot,
    exportedAt,
    makeZip: parsed.flags['no-zip'] !== true,
    includeRaw: mode === 'private',
    allowSecrets: parsed.flags['allow-secrets'] === true,
  });

  reportExport(result, json, mode);
}

async function cmdImport(parsed: Parsed, json: boolean, cwd: string, config: Awaited<ReturnType<typeof loadConfig>>, exportRoot: string): Promise<void> {
  const file = parsed.positionals[0];
  if (!file) throw new SessionPorterError('BAD_ARGS', 'Usage: sessionporter import-transcript <file>');
  const mode: ExportMode = (flagStr(parsed.flags, 'mode') as ExportMode) === 'private' ? 'private' : 'sanitized';
  const result = await importTranscript({
    filePath: resolve(cwd, file),
    cwd,
    mode,
    config,
    exportRoot,
    exportedAt: new Date().toISOString(),
    makeZip: parsed.flags['no-zip'] !== true,
  });
  reportExport(result, json, mode);
}

async function cmdValidate(parsed: Parsed, json: boolean): Promise<void> {
  const dir = parsed.positionals[0];
  if (!dir) throw new SessionPorterError('BAD_ARGS', 'Usage: sessionporter validate <bundle-path>');
  const result = await validateBundle(resolve(process.cwd(), dir));
  if (json) {
    printJsonOk('validate', result);
  } else {
    human(result.ok ? `Bundle is valid (${result.checkedFiles} files checked).` : 'Bundle is INVALID:');
    for (const e of result.errors) human(`  error: ${e}`);
    for (const w of result.warnings) human(`  warning: ${w}`);
  }
  if (!result.ok) process.exitCode = 2;
}

function reportExport(result: ExportResult, json: boolean, mode: ExportMode): void {
  if (json) {
    printJsonOk('export', {
      source: result.meta.source,
      mode,
      outputs: {
        bundleDir: result.bundleDir,
        normalized: result.files.normalized,
        transcript: result.files.transcript,
        summary: result.files.summary,
        redactionReport: result.files.redactionReport,
        zip: result.zipPath,
      },
      redactionTotal: result.redaction.total,
      validation: result.validation,
      gitWarning: result.gitWarning,
    });
    return;
  }
  human('\nExport complete.');
  if (result.gitWarning) human(`Note: ${result.gitWarning}`);
  human(`\nReview before sharing:\n  ${result.files.redactionReport}  (${result.redaction.total} redactions)`);
  human(`\nUpload to AgentTrace:\n  ${result.files.normalized}`);
  human(`\nUpload to an offline Claude conversation:\n  ${result.files.transcript}`);
  if (result.zipPath) human(`\nComplete bundle:\n  ${result.zipPath}`);
  human('\nReminders: review the redaction report, do not upload a private bundle publicly, and remember the transcript may contain proprietary code or personal information.');
}

async function pickSessionInteractive(source: SourceId, cwd: string): Promise<string> {
  const adapter = getAdapter(source);
  if (!adapter) throw new SessionPorterError('NO_ADAPTER', `No adapter for ${source}.`);
  const sessions = await adapter.discover({ limit: 15, cwd });
  const list = sessions.length > 0 ? sessions : await adapter.discover({ limit: 15 });
  if (list.length === 0) throw new SessionPorterError('NO_SESSIONS', `No ${source} sessions found.`);
  human(`\nSelect a ${source} session:`);
  list.forEach((s, i) => human(`  ${i + 1}. ${s.startedAt ?? '?'}  ${s.title ?? s.project ?? '(untitled)'}  [${s.safeSessionId}]`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const choice = await ask(rl, `Enter a number (1-${list.length}): `);
    const idx = Number(choice) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
      throw new SessionPorterError('BAD_ARGS', 'Invalid selection.');
    }
    return list[idx].safeSessionId;
  } finally {
    rl.close();
  }
}

function printHelp(): void {
  human(`SessionPorter — export one AI coding session into a portable, privacy-aware bundle.

Usage:
  sessionporter discover [--source claude|codex] [--recent <days>] [--here] [--query <q>] [--json]
  sessionporter inspect --source claude --session <id> [--json]
  sessionporter redact-preview --source claude --session <id> [--mode sanitized|private] [--json]
  sessionporter export --source claude --session <id> [--mode sanitized|private] [--zip] [--out <dir>] [--json] [--yes]
  sessionporter export --source claude --current
  sessionporter import-transcript <file> [--mode sanitized] [--zip]
  sessionporter validate <bundle-path> [--json]

Defaults: sanitized mode; private mode requires interactive "CONFIRM PRIVATE" or --confirm-private.
Exports are written under .sessionporter/exports/ (git-ignored). Nothing is uploaded.`);
}

void main();
