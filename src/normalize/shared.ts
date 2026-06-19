/** Shared, tool-independent helpers used by every adapter's normalize step. */
import { createHash } from 'node:crypto';
import { TRUNCATION_MARKER } from '../types/index.js';

export type Json = Record<string, unknown>;

export function isObject(x: unknown): x is Json {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function pickString(obj: Json, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

export function getObject(obj: Json, key: string): Json | undefined {
  const v = obj[key];
  return isObject(v) ? v : undefined;
}

const MAX_DEPTH = 24;

/** Flatten arbitrary content (string / block array / object) to plain text. Bounded depth. */
export function flattenContent(value: unknown, depth = 0): string {
  if (depth > MAX_DEPTH) return '[deeply nested content omitted]';
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((b) => flattenBlock(b, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  if (isObject(value)) return flattenBlock(value, depth + 1);
  return String(value);
}

function flattenBlock(block: unknown, depth: number): string {
  if (depth > MAX_DEPTH) return '[deeply nested content omitted]';
  if (typeof block === 'string') return block;
  if (!isObject(block)) return block == null ? '' : String(block);
  if (typeof block.text === 'string') return block.text;
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((b) => flattenBlock(b, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  const t = pickString(block, ['text', 'message', 'value']);
  if (t) return t;
  const type = pickString(block, ['type']);
  if (type) return `[${type} block]`;
  return safeStringify(block);
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Truncate to a character budget with an explicit, recorded marker. */
export function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars) + '\n' + TRUNCATION_MARKER, truncated: true };
}

export function firstToken(command: string | null | undefined): string | undefined {
  if (!command) return undefined;
  const trimmed = command.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0]?.toLowerCase();
}

/** Stable short hash, safe to display (e.g. a sanitized session id). */
export function shortHash(input: string, len = 12): string {
  return createHash('sha256').update(input).digest('hex').slice(0, len);
}

const COMMAND_TOOLS = new Set([
  'bash', 'shell', 'sh', 'powershell', 'pwsh', 'run', 'runcommand', 'run_command',
  'terminal', 'command', 'exec', 'local_shell',
]);

const FILE_TOOLS = new Set([
  'read', 'write', 'edit', 'multiedit', 'multi_edit', 'notebookedit', 'notebook_edit',
  'create', 'createfile', 'delete', 'deletefile', 'move', 'copy', 'rename',
  'applypatch', 'apply_patch', 'str_replace', 'str_replace_editor',
]);

export function isCommandTool(name: string | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return COMMAND_TOOLS.has(n) || /(^|_)(bash|shell|powershell|pwsh|terminal)(_|$)/.test(n);
}

export function isFileTool(name: string | undefined): boolean {
  return name ? FILE_TOOLS.has(name.toLowerCase()) : false;
}

const VERIFICATION_RE =
  /(?:^|[\s&|;(])(?:vitest|jest|mocha|pytest|rspec|phpunit|ctest|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|lint|build|typecheck|type-check)|eslint|tsc\b|prettier\s+--check|go\s+test|go\s+vet|cargo\s+(?:test|check|clippy|build)|mvn\s+(?:test|verify)|gradle\s+(?:test|check|build)|dotnet\s+test|make\s+(?:test|check)|pre-commit\s+run)\b/i;

export function looksLikeVerification(command: string | null | undefined): boolean {
  return command ? VERIFICATION_RE.test(command) : false;
}
