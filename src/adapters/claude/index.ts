/** Claude Code adapter: read-only discovery + normalization of `~/.claude/projects/<slug>/<uuid>.jsonl`. */
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
import { isObject, pickString, shortHash } from '../../normalize/shared.js';
import { normalizeClaude } from './normalize.js';

const HEAD_LINES = 60;

export function claudeProjectsRoot(): string {
  return process.env.SESSIONPORTER_CLAUDE_PROJECTS ?? join(homedir(), '.claude', 'projects');
}

function normCwd(p: string): string {
  return p.replace(/[\\/]+$/, '').toLowerCase();
}

async function listSessionFiles(root: string): Promise<{ path: string; mtimeMs: number; size: number }[]> {
  let slugs: string[];
  try {
    slugs = await readdir(root);
  } catch {
    return [];
  }
  const files: { path: string; mtimeMs: number; size: number }[] = [];
  for (const slug of slugs) {
    const dir = join(root, slug);
    let entries: string[];
    try {
      const s = await stat(dir);
      if (!s.isDirectory()) continue;
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith('.jsonl')) continue;
      const full = join(dir, name);
      try {
        const s = await stat(full);
        if (s.isFile()) files.push({ path: full, mtimeMs: s.mtimeMs, size: s.size });
      } catch {
        /* skip unreadable */
      }
    }
  }
  return files;
}

async function toMeta(filePath: string, mtimeMs: number, size: number): Promise<SessionMeta> {
  const head = await readHead(filePath, HEAD_LINES);
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let startedAt: string | undefined;
  let title: string | undefined;
  for (const rec of head) {
    if (!isObject(rec)) continue;
    sessionId ??= pickString(rec, ['sessionId']);
    cwd ??= pickString(rec, ['cwd']);
    startedAt ??= pickString(rec, ['timestamp']);
    const type = pickString(rec, ['type']);
    if (!title && (type === 'ai-title' || type === 'custom-title')) {
      title = pickString(rec, ['title', 'content', 'message']);
    }
    if (!title && type === 'summary') title = pickString(rec, ['summary']);
  }
  const realId = sessionId ?? basename(filePath, '.jsonl');
  return {
    source: 'claude-code',
    sessionId: realId,
    safeSessionId: shortHash(realId),
    title: title ?? null,
    project: cwd ? basename(cwd.replace(/[\\/]+$/, '')) : null,
    cwd: cwd ?? null,
    filePath,
    startedAt: startedAt ?? null,
    endedAt: new Date(mtimeMs).toISOString(),
    recordCount: await countRecords(filePath),
    sizeBytes: size,
  };
}

export function createClaudeAdapter(): Adapter {
  const root = claudeProjectsRoot();

  return {
    id: 'claude-code',
    label: 'Claude Code',

    async isAvailable() {
      try {
        const s = await stat(root);
        return s.isDirectory();
      } catch {
        return false;
      }
    },

    async discover(opts: DiscoverOptions) {
      let files = await listSessionFiles(root);
      if (opts.recentDays != null) {
        const cutoff = Date.now() - opts.recentDays * 86_400_000;
        files = files.filter((f) => f.mtimeMs >= cutoff);
      }
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      // Read metadata only for a bounded candidate set.
      const cap = Math.min(files.length, Math.max(opts.limit ?? 25, 1) * 4);
      const metas: SessionMeta[] = [];
      for (const f of files.slice(0, cap)) {
        metas.push(await toMeta(f.path, f.mtimeMs, f.size));
      }
      let result = metas;
      if (opts.cwd) {
        const want = normCwd(opts.cwd);
        result = result.filter((m) => m.cwd && normCwd(m.cwd) === want);
      }
      if (opts.query) {
        const q = opts.query.toLowerCase();
        result = result.filter(
          (m) => (m.title ?? '').toLowerCase().includes(q) || (m.project ?? '').toLowerCase().includes(q),
        );
      }
      return result.slice(0, opts.limit ?? 25);
    },

    async getSession(sessionId: string) {
      const files = await listSessionFiles(root);
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const f of files) {
        const meta = await toMeta(f.path, f.mtimeMs, f.size);
        if (
          meta.sessionId === sessionId ||
          meta.safeSessionId === sessionId ||
          meta.safeSessionId.startsWith(sessionId) ||
          basename(f.path, '.jsonl') === sessionId
        ) {
          return meta;
        }
      }
      return null;
    },

    async resolveCurrent(cwd: string) {
      const want = normCwd(cwd);
      const files = await listSessionFiles(root);
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const f of files) {
        const meta = await toMeta(f.path, f.mtimeMs, f.size);
        if (meta.cwd && normCwd(meta.cwd) === want) {
          return {
            meta,
            how: `newest Claude Code session whose recorded cwd matches "${cwd}" (heuristic: a CLI cannot observe the invoking session id, so this may be wrong if multiple sessions share a directory)`,
          };
        }
      }
      return null;
    },

    async *readRecords(meta: SessionMeta, limits: ReadLimits): AsyncGenerator<RawRecord> {
      yield* readJsonl(meta.filePath, limits);
    },

    normalize(records: RawRecord[], meta: SessionMeta, limits: ReadLimits): NormalizeResult {
      return normalizeClaude(records, meta, limits.maxEventChars);
    },
  };
}
