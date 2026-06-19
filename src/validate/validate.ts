/** Validate a written bundle: manifest present, files present, checksums match,
 * normalized JSONL parses. Used after every export and by `validate <path>`. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, parseChecksumsFile } from '../bundle/checksums.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedFiles: number;
}

export async function validateBundle(bundleDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedFiles = 0;

  try {
    const s = await stat(bundleDir);
    if (!s.isDirectory()) {
      return { ok: false, errors: [`Not a directory: ${bundleDir}`], warnings, checkedFiles };
    }
  } catch {
    return { ok: false, errors: [`Bundle directory not found: ${bundleDir}`], warnings, checkedFiles };
  }

  // checksums.sha256
  let checksums: Record<string, string> = {};
  try {
    checksums = parseChecksumsFile(await readFile(join(bundleDir, 'checksums.sha256'), 'utf8'));
  } catch {
    errors.push('checksums.sha256 is missing or unreadable.');
  }

  for (const [name, expected] of Object.entries(checksums)) {
    if (name === 'checksums.sha256') {
      errors.push('checksums.sha256 must not list itself.');
      continue;
    }
    try {
      const data = await readFile(join(bundleDir, name));
      const actual = sha256(data);
      checkedFiles += 1;
      if (actual !== expected) errors.push(`Checksum mismatch for ${name}.`);
    } catch {
      errors.push(`Listed file is missing: ${name}.`);
    }
  }

  // manifest
  try {
    const manifest = JSON.parse(await readFile(join(bundleDir, 'manifest.json'), 'utf8')) as {
      files?: string[];
      mode?: string;
    };
    for (const f of manifest.files ?? []) {
      try {
        await stat(join(bundleDir, f));
      } catch {
        errors.push(`manifest lists a missing file: ${f}.`);
      }
    }
    if (manifest.mode === 'sanitized') {
      const present = await readdir(bundleDir);
      if (present.includes('session.raw.jsonl') || present.includes('session.raw.json')) {
        errors.push('Sanitized bundle must not contain a raw session file.');
      }
    }
  } catch {
    errors.push('manifest.json is missing or invalid JSON.');
  }

  // normalized jsonl parses
  try {
    const body = await readFile(join(bundleDir, 'session.normalized.jsonl'), 'utf8');
    let n = 0;
    for (const line of body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      n += 1;
      try {
        JSON.parse(line);
      } catch {
        errors.push(`session.normalized.jsonl line ${n} is not valid JSON.`);
        break;
      }
    }
    if (n === 0) warnings.push('session.normalized.jsonl has no events.');
  } catch {
    errors.push('session.normalized.jsonl is missing.');
  }

  return { ok: errors.length === 0, errors, warnings, checkedFiles };
}
