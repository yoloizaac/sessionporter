/** EXPERIMENTAL Codex adapter: read-only discovery of `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. */
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import type {
  Adapter,
  DiscoverOptions,
  NormalizeResult,
  RawRecord,
  ReadLimits,
  SessionMeta,
} from '../../types/index.js';
import { readHead, readJsonl, countRecords } from '../../core/jsonl.js';
import { getObject, pickString, shortHash } from '../../normalize/shared.js';
import { normalizeCodex } from './normalize.js';

const HEAD_LINES = 30;
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function codexSessionsRoot(): string {
  return process.env.SESSIONPORTER_CODEX_SESSIONS ?? join(homedir(), '.codex', 'sessions');
}

function normCwd(p: string): string {
  return p.replace(/[\\/]+$/, '').toLowerCase();
}

async function walk(dir: string, depth: number, out: { path: string; mtimeMs: number; size: number }[]): Promise<void> {
  if (depth > 4) return;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) await walk(full, depth + 1, out);
    else if (s.isFile() && name.endsWith('.jsonl') && name.startsWith('rollout-')) {
      out.push({ path: full, mtimeMs: s.mtimeMs, size: s.size });
    }
  }
}

async function toMeta(filePath: string, mtimeMs: number, size: number): Promise<SessionMeta> {
  const head = await readHead(filePath, HEAD_LINES);
  let cwd: string | undefined;
  let startedAt: string | undefined;
  let idFromMeta: string | undefined;
  for (const rec of head) {
    startedAt ??= pickString(rec, ['timestamp']);
    if (pickString(rec, ['type']) === 'session_meta') {
      const payload = getObject(rec, 'payload');
      if (payload) {
        cwd ??= pickString(payload, ['cwd']);
        idFromMeta ??= pickString(payload, ['id']);
      }
    }
  }
  const fromName = filePath.match(UUID_RE)?.[1];
  const realId = idFromMeta ?? fromName ?? basename(filePath, '.jsonl');
  return {
    source: 'codex',
    sessionId: realId,
    safeSessionId: shortHash(realId),
    title: cwd ? `Codex session in ${basename(cwd.replace(/[\\/]+$/, ''))}` : 'Codex session',
    project: cwd ? basename(cwd.replace(/[\\/]+$/, '')) : null,
    cwd: cwd ?? null,
    filePath,
    startedAt: startedAt ?? null,
    endedAt: new Date(mtimeMs).toISOString(),
    recordCount: await countRecords(filePath),
    sizeBytes: size,
  };
}

export function createCodexAdapter(): Adapter {
  const root = codexSessionsRoot();

  return {
    id: 'codex',
    label: 'Codex (experimental)',

    async isAvailable() {
      try {
        return (await stat(root)).isDirectory();
      } catch {
        return false;
      }
    },

    async discover(opts: DiscoverOptions) {
      const files: { path: string; mtimeMs: number; size: number }[] = [];
      await walk(root, 0, files);
      if (opts.recentDays != null) {
        const cutoff = Date.now() - opts.recentDays * 86_400_000;
        for (let i = files.length - 1; i >= 0; i--) if (files[i].mtimeMs < cutoff) files.splice(i, 1);
      }
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const cap = Math.min(files.length, Math.max(opts.limit ?? 25, 1) * 4);
      let metas: SessionMeta[] = [];
      for (const f of files.slice(0, cap)) metas.push(await toMeta(f.path, f.mtimeMs, f.size));
      if (opts.cwd) {
        const want = normCwd(opts.cwd);
        metas = metas.filter((m) => m.cwd && normCwd(m.cwd) === want);
      }
      if (opts.query) {
        const q = opts.query.toLowerCase();
        metas = metas.filter((m) => (m.project ?? '').toLowerCase().includes(q));
      }
      return metas.slice(0, opts.limit ?? 25);
    },

    async getSession(sessionId: string) {
      const files: { path: string; mtimeMs: number; size: number }[] = [];
      await walk(root, 0, files);
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const f of files) {
        const meta = await toMeta(f.path, f.mtimeMs, f.size);
        if (meta.sessionId === sessionId || meta.safeSessionId === sessionId || meta.safeSessionId.startsWith(sessionId)) {
          return meta;
        }
      }
      return null;
    },

    async resolveCurrent(cwd: string) {
      const want = normCwd(cwd);
      const files: { path: string; mtimeMs: number; size: number }[] = [];
      await walk(root, 0, files);
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const f of files) {
        const meta = await toMeta(f.path, f.mtimeMs, f.size);
        if (meta.cwd && normCwd(meta.cwd) === want) {
          return { meta, how: `newest Codex session whose session_meta.cwd matches "${cwd}" (heuristic, experimental adapter)` };
        }
      }
      return null;
    },

    async *readRecords(meta: SessionMeta, limits: ReadLimits): AsyncGenerator<RawRecord> {
      yield* readJsonl(meta.filePath, limits);
    },

    normalize(records: RawRecord[], meta: SessionMeta, limits: ReadLimits): NormalizeResult {
      return normalizeCodex(records, meta, limits.maxEventChars);
    },
  };
}
