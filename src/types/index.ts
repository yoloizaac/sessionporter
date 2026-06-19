/**
 * Shared types for SessionPorter. The normalized event model is tool-independent;
 * adapters map a source record into one or more of these. The engine (redaction,
 * bundle, validation) only ever deals with NormalizedEvent and plain text.
 */

export const SCHEMA_VERSION = '1.0';
export const EXPORTER_VERSION = '0.1.0';

export type SourceId = 'claude-code' | 'codex' | 'manual';

export type Role = 'user' | 'assistant' | 'tool' | 'system' | 'unknown';

export type Category =
  | 'user_prompt'
  | 'assistant_message'
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'command'
  | 'file_operation'
  | 'error'
  | 'verification'
  | 'summary'
  | 'unknown';

export type Status = 'success' | 'failure' | 'pending' | 'unknown';

export type ExportMode = 'sanitized' | 'private';

/** One normalized event. Mirrors the bundle's session.normalized.jsonl line. */
export interface NormalizedEvent {
  schemaVersion: string;
  id: string;
  sessionId: string;
  source: SourceId;
  timestamp: string | null;
  sequence: number;
  role: Role;
  category: Category;
  title: string;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  command: string | null;
  filePath: string | null;
  status: Status;
  inferred: boolean;
  sourceType: string;
  /** Redaction categories applied to this event's content (sanitized mode). */
  redactions: string[];
}

export interface ParseWarning {
  message: string;
  line?: number;
  severity: 'warning' | 'error';
}

/** A raw source record plus its source line number (for warnings). */
export interface RawRecord {
  value: unknown;
  line?: number;
}

/** Metadata about a discoverable session. `filePath` is never shown in sanitized previews. */
export interface SessionMeta {
  source: SourceId;
  /** Real source session id (kept local; hashed for sanitized display). */
  sessionId: string;
  /** Stable short hash of sessionId, safe to display/share. */
  safeSessionId: string;
  title: string | null;
  /** Project slug or working-directory basename, when known. */
  project: string | null;
  cwd: string | null;
  /** Absolute path to the session file on disk. Local only. */
  filePath: string;
  startedAt: string | null;
  endedAt: string | null;
  /** Number of source records (lines) — not the normalized event count. */
  recordCount: number;
  sizeBytes: number;
}

export interface NormalizeResult {
  events: NormalizedEvent[];
  warnings: ParseWarning[];
}

/**
 * An adapter is the only tool-specific part: it discovers sessions for one
 * source, resolves the current session, reads raw records, and normalizes them.
 * Everything downstream (redaction, bundle, validation) is shared.
 */
export interface Adapter {
  id: SourceId;
  /** Human label, e.g. "Claude Code". */
  label: string;
  /** Whether this adapter is available in the current environment. */
  isAvailable(): Promise<boolean>;
  /** List sessions (metadata only). */
  discover(opts: DiscoverOptions): Promise<SessionMeta[]>;
  /** Resolve a session by its id (or short hash prefix). */
  getSession(sessionId: string): Promise<SessionMeta | null>;
  /** Resolve the "current" session for a working directory, with a note on how. */
  resolveCurrent(cwd: string): Promise<{ meta: SessionMeta; how: string } | null>;
  /** Read raw records (streaming, bounded by limits). */
  readRecords(meta: SessionMeta, limits: ReadLimits): AsyncGenerator<RawRecord>;
  /** Map raw records to normalized events. Tool-specific. */
  normalize(records: RawRecord[], meta: SessionMeta, limits: ReadLimits): NormalizeResult;
}

export interface DiscoverOptions {
  /** Restrict to sessions whose project/cwd matches this path basename. */
  cwd?: string;
  /** Only sessions modified within this many days. */
  recentDays?: number;
  /** Free-text filter over title/project. */
  query?: string;
  limit?: number;
}

export interface ReadLimits {
  /** Reject inputs larger than this many bytes. */
  maxFileBytes: number;
  /** Truncate any single event's content beyond this many characters. */
  maxEventChars: number;
}

export const DEFAULT_LIMITS: ReadLimits = {
  maxFileBytes: 200 * 1024 * 1024, // 200 MB hard cap
  maxEventChars: 100_000,
};

export const TRUNCATION_MARKER =
  '[TRUNCATED BY SESSIONPORTER: original content exceeded configured event limit]';

/** Local config (.sessionporter.json). Never stores secrets. */
export interface SessionPorterConfig {
  redactTerms: string[];
  redactEmails: boolean;
  redactHomeDirectory: boolean;
  includeToolOutputs: boolean;
  maxToolOutputCharacters: number;
}

export const DEFAULT_CONFIG: SessionPorterConfig = {
  redactTerms: [],
  redactEmails: true,
  redactHomeDirectory: true,
  includeToolOutputs: true,
  maxToolOutputCharacters: 100_000,
};
