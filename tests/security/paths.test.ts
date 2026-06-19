import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeName, assertWithin, assertNotSymlink, atomicWrite } from '../../src/security/paths.js';
import { SessionPorterError } from '../../src/core/errors.js';

describe('sanitizeName', () => {
  it('strips path separators and traversal', () => {
    expect(sanitizeName('../../etc/passwd')).not.toMatch(/[\\/]/);
    expect(sanitizeName('../../etc/passwd')).not.toContain('..');
    expect(sanitizeName('a/b\\c')).not.toMatch(/[\\/]/);
  });
  it('falls back when nothing safe remains', () => {
    expect(sanitizeName('')).toBe('session');
    expect(sanitizeName('///')).toBe('session');
  });
  it('keeps a reasonable name', () => {
    expect(sanitizeName('Add CSV export')).toBe('Add_CSV_export');
  });
});

describe('assertWithin', () => {
  const base = join(tmpdir(), 'sp-base');
  it('allows a contained relative path', () => {
    expect(() => assertWithin(base, 'sub/file.txt')).not.toThrow();
  });
  it('rejects traversal', () => {
    expect(() => assertWithin(base, '../escape')).toThrow(SessionPorterError);
    expect(() => assertWithin(base, '..\\..\\escape')).toThrow(SessionPorterError);
  });
  it('rejects an absolute escape', () => {
    const abs = process.platform === 'win32' ? 'C:\\Windows\\system32' : '/etc/passwd';
    expect(() => assertWithin(base, abs)).toThrow(SessionPorterError);
  });
});

describe('atomicWrite + symlink refusal', () => {
  it('writes a file atomically and refuses to clobber nothing wrong', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sp-aw-'));
    const target = join(dir, 'out.txt');
    await atomicWrite(target, 'hello');
    await expect(assertNotSymlink(target)).resolves.toBeUndefined();
  });
  it('does not throw asserting a non-existent path', async () => {
    await expect(assertNotSymlink(join(tmpdir(), 'sp-nope-xyz'))).resolves.toBeUndefined();
  });
});
