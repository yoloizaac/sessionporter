/**
 * Redaction engine. Applies the ordered rules to strings and to whole events.
 * Tokens never reveal originals; the report only ever sees category + count +
 * event location, never a value.
 */
import type { NormalizedEvent, SessionPorterConfig } from '../types/index.js';
import { rulesFor } from './rules.js';

export interface RedactionResult {
  text: string;
  /** Distinct categories that fired on this string. */
  categories: string[];
  counts: Record<string, number>;
}

export interface RedactionSummary {
  total: number;
  byCategory: Record<string, number>;
  /** Event sequence numbers affected, per category (no values). */
  locations: Record<string, number[]>;
}

export interface RedactOptions {
  mode: 'sanitized' | 'private';
  config: SessionPorterConfig;
  /** Deliberate override: only honoured in private mode; disables all rules. */
  allowSecrets?: boolean;
}

/** Redact a single string. Two-pass per rule (count, then replace) for accuracy. */
export function redactString(text: string, opts: RedactOptions): RedactionResult {
  const counts: Record<string, number> = {};
  if (opts.allowSecrets && opts.mode === 'private') {
    return { text, categories: [], counts };
  }
  let out = text;
  for (const rule of rulesFor(opts.mode, opts.config)) {
    const matches = out.match(rule.pattern);
    if (matches && matches.length > 0) {
      counts[rule.category] = (counts[rule.category] ?? 0) + matches.length;
      out = out.replace(rule.pattern, rule.replace ?? rule.token);
    }
  }
  return { text: out, categories: Object.keys(counts), counts };
}

const STRING_FIELDS: Array<keyof NormalizedEvent> = [
  'content',
  'command',
  'filePath',
  'title',
];

/**
 * Redact every event in place (on copies), aggregating a summary. Returns new
 * event objects so the caller's source data is never mutated.
 */
export function redactEvents(
  events: NormalizedEvent[],
  opts: RedactOptions,
): { events: NormalizedEvent[]; summary: RedactionSummary } {
  const byCategory: Record<string, number> = {};
  const locations: Record<string, number[]> = {};
  let total = 0;

  const out = events.map((ev) => {
    const copy: NormalizedEvent = { ...ev, redactions: [] };
    const firedHere = new Set<string>();

    for (const field of STRING_FIELDS) {
      const value = copy[field];
      if (typeof value !== 'string' || value.length === 0) continue;
      const result = redactString(value, opts);
      if (result.categories.length > 0) {
        (copy[field] as string) = result.text;
        for (const [cat, n] of Object.entries(result.counts)) {
          byCategory[cat] = (byCategory[cat] ?? 0) + n;
          total += n;
          firedHere.add(cat);
        }
      }
    }

    if (firedHere.size > 0) {
      copy.redactions = [...firedHere].sort();
      for (const cat of firedHere) {
        (locations[cat] ??= []).push(copy.sequence);
      }
    }
    return copy;
  });

  return { events: out, summary: { total, byCategory, locations } };
}
