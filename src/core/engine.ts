/** High-level operations used by the CLI. Tool-independent: adapters provide
 * records, the engine redacts and bundles. */
import { basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import {
  DEFAULT_LIMITS,
  type ExportMode,
  type NormalizedEvent,
  type SessionMeta,
  type SessionPorterConfig,
  type SourceId,
} from '../types/index.js';
import { getAdapter } from '../discovery/index.js';
import { redactEvents, type RedactionSummary } from '../redact/redactor.js';
import { rulesFor } from '../redact/rules.js';
import { writeBundle, type BundleResult } from '../bundle/writer.js';
import { analyzeEvents, type SessionStats } from './analyze.js';
import { SessionPorterError } from './errors.js';
import { shortHash } from '../normalize/shared.js';
import { detectManualFormat, normalizeManual } from '../adapters/manual/normalize.js';

export interface Completeness {
  knownComplete: boolean;
  text: string;
}

export function completenessFor(source: SourceId): Completeness {
  switch (source) {
    case 'claude-code':
      return {
        knownComplete: false,
        text:
          "Records are the local Claude Code session log. Plaintext 'thinking' (model reasoning) blocks are included where present; truncated tool outputs are marked. A single .jsonl can be a resumed or forked session, so it may be a partial logical conversation. No cloud account was accessed.",
      };
    case 'codex':
      return {
        knownComplete: false,
        text:
          'EXPERIMENTAL Codex export. Model reasoning is stored encrypted by Codex and is NOT recoverable. The dual event channels are de-duplicated heuristically, and payload shapes may vary by Codex version.',
      };
    case 'manual':
    default:
      return {
        knownComplete: false,
        text:
          'Imported from a transcript file. Tool calls, file operations, and outcomes may be incomplete because they are not present in a generic transcript, and roles may be inferred.',
      };
  }
}

export interface ResolveResult {
  meta: SessionMeta;
  how: string | null;
}

export async function resolveSession(
  source: SourceId,
  opts: { sessionId?: string; current?: boolean; cwd: string },
): Promise<ResolveResult> {
  const adapter = getAdapter(source);
  if (!adapter) throw new SessionPorterError('NO_ADAPTER', `No adapter for source "${source}".`);
  if (opts.current) {
    const r = await adapter.resolveCurrent(opts.cwd);
    if (!r) {
      throw new SessionPorterError(
        'CURRENT_AMBIGUOUS',
        `Could not resolve a current ${source} session for ${opts.cwd}. Pick one with --session, or run discover.`,
      );
    }
    return { meta: r.meta, how: r.how };
  }
  if (opts.sessionId) {
    const meta = await adapter.getSession(opts.sessionId);
    if (!meta) throw new SessionPorterError('SESSION_NOT_FOUND', `No ${source} session matching "${opts.sessionId}".`);
    return { meta, how: null };
  }
  throw new SessionPorterError('NO_SELECTION', 'Specify --session <id> or --current.');
}

async function loadEvents(
  meta: SessionMeta,
  config: SessionPorterConfig,
): Promise<{ events: NormalizedEvent[]; warnings: string[]; truncationCount: number }> {
  const adapter = getAdapter(meta.source);
  if (!adapter) throw new SessionPorterError('NO_ADAPTER', `No adapter for source "${meta.source}".`);
  const limits = { maxFileBytes: DEFAULT_LIMITS.maxFileBytes, maxEventChars: config.maxToolOutputCharacters };
  const records = [];
  for await (const r of adapter.readRecords(meta, limits)) records.push(r);
  const { events, warnings } = adapter.normalize(records, meta, limits);
  const truncationCount = warnings.filter((w) => /truncat/i.test(w.message)).length;
  return { events, warnings: warnings.map((w) => w.message), truncationCount };
}

export interface PreviewResult {
  meta: SessionMeta;
  how: string | null;
  stats: SessionStats;
  redaction: RedactionSummary;
  warnings: string[];
}

export async function redactPreview(opts: {
  source: SourceId;
  sessionId?: string;
  current?: boolean;
  cwd: string;
  mode: ExportMode;
  config: SessionPorterConfig;
}): Promise<PreviewResult> {
  const { meta, how } = await resolveSession(opts.source, opts);
  const { events: raw, warnings } = await loadEvents(meta, opts.config);
  const { events, summary } = redactEvents(raw, { mode: opts.mode, config: opts.config });
  return { meta, how, stats: analyzeEvents(events), redaction: summary, warnings };
}

export interface ExportOptions {
  source: SourceId;
  sessionId?: string;
  current?: boolean;
  cwd: string;
  mode: ExportMode;
  config: SessionPorterConfig;
  exportRoot: string;
  exportedAt: string;
  makeZip: boolean;
  includeRaw: boolean;
  allowSecrets: boolean;
}

export interface ExportResult extends BundleResult {
  meta: SessionMeta;
  how: string | null;
  redaction: RedactionSummary;
  stats: SessionStats;
}

export async function exportSession(opts: ExportOptions): Promise<ExportResult> {
  if (opts.allowSecrets && opts.mode !== 'private') {
    throw new SessionPorterError('UNSAFE_REQUIRES_PRIVATE', 'Disabling redaction is only possible in private mode.');
  }
  const { meta, how } = await resolveSession(opts.source, opts);
  const { events: raw, warnings, truncationCount } = await loadEvents(meta, opts.config);
  const idForEvents = opts.mode === 'sanitized' ? meta.safeSessionId : meta.sessionId;
  for (const e of raw) e.sessionId = idForEvents;
  const { events, summary } = redactEvents(raw, { mode: opts.mode, config: opts.config, allowSecrets: opts.allowSecrets });
  const comp = completenessFor(opts.source);
  const bundle = await writeBundle({
    meta,
    mode: opts.mode,
    events,
    redaction: summary,
    rulesRan: rulesFor(opts.mode, opts.config).map((r) => r.category),
    warnings,
    truncationCount,
    completeness: comp.text,
    knownComplete: comp.knownComplete,
    exportRoot: opts.exportRoot,
    exportedAt: opts.exportedAt,
    includeRaw: opts.includeRaw,
    makeZip: opts.makeZip,
  });
  return { ...bundle, meta, how, redaction: summary, stats: analyzeEvents(events) };
}

export async function importTranscript(opts: {
  filePath: string;
  cwd: string;
  mode: ExportMode;
  config: SessionPorterConfig;
  exportRoot: string;
  exportedAt: string;
  makeZip: boolean;
}): Promise<ExportResult> {
  let text: string;
  let size: number;
  try {
    text = await readFile(opts.filePath, 'utf8');
    size = (await stat(opts.filePath)).size;
  } catch {
    throw new SessionPorterError('SOURCE_UNREADABLE', `Cannot read transcript file: ${opts.filePath}`);
  }
  const format = detectManualFormat(opts.filePath, text);
  const realId = shortHash(`manual:${basename(opts.filePath)}:${size}`);
  const { events: raw, warnings } = normalizeManual(text, format, realId, opts.config.maxToolOutputCharacters);
  const meta: SessionMeta = {
    source: 'manual',
    sessionId: realId,
    safeSessionId: realId,
    title: basename(opts.filePath),
    project: null,
    cwd: null,
    filePath: opts.filePath,
    startedAt: null,
    endedAt: null,
    recordCount: raw.length,
    sizeBytes: size,
  };
  const { events, summary } = redactEvents(raw, { mode: opts.mode, config: opts.config });
  const comp = completenessFor('manual');
  const bundle = await writeBundle({
    meta,
    mode: opts.mode,
    events,
    redaction: summary,
    rulesRan: rulesFor(opts.mode, opts.config).map((r) => r.category),
    warnings: warnings.map((w) => w.message),
    truncationCount: warnings.filter((w) => /truncat/i.test(w.message)).length,
    completeness: comp.text,
    knownComplete: comp.knownComplete,
    exportRoot: opts.exportRoot,
    exportedAt: opts.exportedAt,
    includeRaw: false,
    makeZip: opts.makeZip,
  });
  return { ...bundle, meta, how: null, redaction: summary, stats: analyzeEvents(events) };
}
