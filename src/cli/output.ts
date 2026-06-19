/** CLI output: a stable JSON envelope for machine use (--json) and human text. */
import { errorCode, errorMessage } from '../core/errors.js';

export interface JsonEnvelope {
  ok: boolean;
  command: string;
  data?: unknown;
  error?: { code: string; message: string };
}

export function printJsonOk(command: string, data: unknown): void {
  const env: JsonEnvelope = { ok: true, command, data };
  process.stdout.write(JSON.stringify(env) + '\n');
}

export function printJsonError(command: string, err: unknown): void {
  const env: JsonEnvelope = {
    ok: false,
    command,
    error: { code: errorCode(err), message: errorMessage(err) },
  };
  process.stdout.write(JSON.stringify(env) + '\n');
}

export function human(line = ''): void {
  process.stdout.write(line + '\n');
}

export function humanErr(line: string): void {
  process.stderr.write(line + '\n');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Exit code policy: 0 ok, 2 user-correctable, 1 unexpected. */
export function exitCodeFor(code: string): number {
  const userCorrectable = new Set([
    'NO_SELECTION',
    'SESSION_NOT_FOUND',
    'CURRENT_AMBIGUOUS',
    'OUTPUT_EXISTS',
    'PRIVATE_NOT_CONFIRMED',
    'NO_SESSIONS',
    'SOURCE_UNREADABLE',
    'FILE_TOO_LARGE',
    'UNSAFE_REQUIRES_PRIVATE',
    'UNSUPPORTED_SOURCE',
    'BAD_ARGS',
  ]);
  return userCorrectable.has(code) ? 2 : 1;
}
