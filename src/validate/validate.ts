/** Validate a written bundle: manifest present, files present, checksums match,
 * normalized JSONL parses. Used after every export and by `validate <path>`. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256, parseChecksumsFile } from '../bundle/checksums.js';
import { verifyChecksumsSignature, SIGNATURE_FILE } from '../bundle/signing.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedFiles: number;
  /** Provenance signature status: 'absent' when the bundle is unsigned. */
  signature: 'valid' | 'invalid' | 'absent';
  /** Public-key fingerprint of the signer when a signature is present. */
  signerFingerprint: string | null;
}

export async function validateBundle(bundleDir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedFiles = 0;
  let signature: 'valid' | 'invalid' | 'absent' = 'absent';
  let signerFingerprint: string | null = null;

  try {
    const s = await stat(bundleDir);
    if (!s.isDirectory()) {
      return { ok: false, errors: [`Not a directory: ${bundleDir}`], warnings, checkedFiles, signature, signerFingerprint };
    }
  } catch {
    return { ok: false, errors: [`Bundle directory not found: ${bundleDir}`], warnings, checkedFiles, signature, signerFingerprint };
  }

  // checksums.sha256
  let checksumsText: string | null = null;
  let checksums: Record<string, string> = {};
  try {
    checksumsText = await readFile(join(bundleDir, 'checksums.sha256'), 'utf8');
    checksums = parseChecksumsFile(checksumsText);
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

  // Provenance signature (optional). Absent is fine; present-but-bad is an error.
  let signatureRaw: string | null = null;
  try {
    signatureRaw = await readFile(join(bundleDir, SIGNATURE_FILE), 'utf8');
  } catch {
    // ENOENT: bundle is unsigned.
  }
  if (signatureRaw !== null) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(signatureRaw);
    } catch {
      signature = 'invalid';
      errors.push('signature.json is present but not valid JSON.');
    }
    if (signature !== 'invalid') {
      if (checksumsText === null) {
        signature = 'invalid';
        errors.push('signature.json is present but checksums.sha256 is missing; cannot verify provenance.');
      } else {
        const check = verifyChecksumsSignature(parsed, checksumsText);
        signerFingerprint = check.fingerprint;
        if (check.valid) {
          signature = 'valid';
        } else {
          signature = 'invalid';
          errors.push(`Provenance signature is invalid: ${check.reason}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, checkedFiles, signature, signerFingerprint };
}
