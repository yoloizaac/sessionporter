/** Streaming JSONL helpers. Files are read line-by-line so multi-hundred-MB logs
 * never load entirely as one string. */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { RawRecord, ReadLimits } from '../types/index.js';
import { SessionPorterError } from './errors.js';

/** Yield one RawRecord per non-blank line. Malformed lines are preserved as markers. */
export async function* readJsonl(filePath: string, limits: ReadLimits): AsyncGenerator<RawRecord> {
  const st = await stat(filePath);
  if (st.size > limits.maxFileBytes) {
    throw new SessionPorterError(
      'FILE_TOO_LARGE',
      `Session file is ${st.size} bytes, over the configured ${limits.maxFileBytes}-byte limit.`,
    );
  }
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let line = 0;
  for await (const raw of rl) {
    line += 1;
    const t = raw.trim();
    if (!t) continue;
    try {
      yield { value: JSON.parse(t), line };
    } catch {
      yield { value: { 'sessionporter:parseError': t.slice(0, 120) }, line };
    }
  }
}

/** Read up to `maxLines` parsed objects from the start (for cheap metadata). */
export async function readHead(filePath: string, maxLines: number): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  try {
    for await (const raw of rl) {
      const t = raw.trim();
      if (!t) continue;
      try {
        const v: unknown = JSON.parse(t);
        if (v && typeof v === 'object' && !Array.isArray(v)) out.push(v as Record<string, unknown>);
      } catch {
        /* ignore malformed during head scan */
      }
      if (out.length >= maxLines) break;
    }
  } finally {
    rl.close();
  }
  return out;
}

/** Count non-blank lines (record count) without loading the whole file. */
export async function countRecords(filePath: string): Promise<number> {
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
  let n = 0;
  try {
    for await (const raw of rl) {
      if (raw.trim()) n += 1;
    }
  } finally {
    rl.close();
  }
  return n;
}
