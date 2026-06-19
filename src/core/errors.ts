/** Typed error with a stable machine-readable code (surfaced in --json output). */
export class SessionPorterError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SessionPorterError';
    this.code = code;
  }
}

export function errorCode(err: unknown): string {
  return err instanceof SessionPorterError ? err.code : 'UNEXPECTED';
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
