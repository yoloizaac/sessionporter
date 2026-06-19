/** Filesystem safety: filename sanitization, path containment, symlink refusal,
 * atomic writes, restrictive permissions. All bundle writes go through here. */
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, rename, writeFile, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { SessionPorterError } from '../core/errors.js';

/** Reduce an arbitrary string to a safe single path segment (no separators, no traversal). */
export function sanitizeName(name: string, fallback = 'session'): string {
  const out = (name || '')
    .replace(/[\\/]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/_+/g, '_')
    .slice(0, 80);
  if (!/[A-Za-z0-9]/.test(out)) return fallback;
  return out;
}

/** Throw unless `target` resolves inside `base` (blocks traversal / absolute escapes). */
export function assertWithin(base: string, target: string): string {
  const resolvedBase = resolve(base);
  const resolvedTarget = resolve(base, target);
  const rel = relative(resolvedBase, resolvedTarget);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new SessionPorterError('PATH_TRAVERSAL', `Refusing to write outside the export directory: ${target}`);
  }
  return resolvedTarget;
}

/** Refuse to operate on a path that is (or whose parent is) a symlink. */
export async function assertNotSymlink(path: string): Promise<void> {
  try {
    const st = await lstat(path);
    if (st.isSymbolicLink()) {
      throw new SessionPorterError('SYMLINK_REFUSED', `Refusing to follow a symbolic link: ${path}`);
    }
  } catch (err) {
    if (err instanceof SessionPorterError) throw err;
    // ENOENT is fine: the path does not exist yet.
  }
}

export async function ensureDir(path: string): Promise<void> {
  await assertNotSymlink(path);
  await mkdir(path, { recursive: true, mode: 0o700 });
}

/** Write a file atomically (temp file + rename), refusing to clobber a symlink. */
export async function atomicWrite(path: string, data: string | Uint8Array): Promise<void> {
  await assertNotSymlink(path);
  const dir = dirname(path);
  const tmp = resolve(dir, `.sp-${randomBytes(6).toString('hex')}.partial`);
  await writeFile(tmp, data, { mode: 0o600 });
  await rename(tmp, path);
}

/**
 * Detect whether `dir` is inside a Git working tree (so we can warn before
 * writing an export there). Walks up looking for a `.git` entry.
 */
export async function findGitRoot(dir: string): Promise<string | null> {
  let current = resolve(dir);
  // bound the walk
  for (let i = 0; i < 64; i++) {
    try {
      const st = await lstat(resolve(current, '.git'));
      if (st.isDirectory() || st.isFile()) return current;
    } catch {
      /* not here */
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** Resolve the canonical path of an existing file, for containment checks. */
export async function safeRealpath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

export const PATH_SEP = sep;
