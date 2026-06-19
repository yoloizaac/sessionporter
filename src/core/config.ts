/** Load `.sessionporter.json` from the working directory. Only known keys are
 * honoured; unknown keys are ignored. The config must never contain secrets. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type SessionPorterConfig } from '../types/index.js';

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asPosInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export async function loadConfig(cwd: string): Promise<SessionPorterConfig> {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = await readFile(join(cwd, '.sessionporter.json'), 'utf8');
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  return {
    redactTerms: asStringArray(parsed.redactTerms),
    redactEmails: asBool(parsed.redactEmails, DEFAULT_CONFIG.redactEmails),
    redactHomeDirectory: asBool(parsed.redactHomeDirectory, DEFAULT_CONFIG.redactHomeDirectory),
    includeToolOutputs: asBool(parsed.includeToolOutputs, DEFAULT_CONFIG.includeToolOutputs),
    maxToolOutputCharacters: asPosInt(parsed.maxToolOutputCharacters, DEFAULT_CONFIG.maxToolOutputCharacters),
  };
}
