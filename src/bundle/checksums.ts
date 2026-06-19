/** SHA-256 helpers and the checksums.sha256 file body. */
import { createHash } from 'node:crypto';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Build the checksums.sha256 body for a set of files. The checksums file itself
 * is never one of `files` (it cannot hash its own final content), avoiding the
 * recursive self-checksum problem.
 */
export function buildChecksumsFile(files: Record<string, string | Uint8Array>): string {
  return (
    Object.keys(files)
      .sort()
      .map((name) => `${sha256(files[name])}  ${name}`)
      .join('\n') + '\n'
  );
}

/** Parse a checksums.sha256 body into { filename: hash }. */
export function parseChecksumsFile(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^([0-9a-f]{64})\s+(.+)$/i);
    if (m) out[m[2]] = m[1].toLowerCase();
  }
  return out;
}
