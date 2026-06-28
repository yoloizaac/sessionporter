import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateSigningKeyPair,
  signChecksums,
  verifyChecksumsSignature,
  publicKeyFingerprint,
} from '../src/bundle/signing.js';
import { sha256 } from '../src/bundle/checksums.js';
import { exportSession } from '../src/core/engine.js';
import { validateBundle } from '../src/validate/validate.js';
import {
  useFixtureSources, tempExportRoot, testConfig, CLAUDE_SESSION_ID, CLAUDE_CWD,
} from './helpers.js';

beforeAll(() => useFixtureSources());

const SIGNED_AT = '2026-06-29T00:00:00.000Z';

describe('signing primitives', () => {
  it('round-trips: a fresh signature verifies against the same body', () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const body = 'abc123  manifest.json\n';
    const sig = signChecksums(body, privateKeyPem, SIGNED_AT);
    const check = verifyChecksumsSignature(sig, body);
    expect(check.valid).toBe(true);
    expect(check.fingerprint).toBe(sig.publicKeyFingerprint);
  });

  it('fails when the signed body is altered by even one byte', () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const body = 'abc123  manifest.json\n';
    const sig = signChecksums(body, privateKeyPem, SIGNED_AT);
    const check = verifyChecksumsSignature(sig, body + ' ');
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/does not match/i);
  });

  it('embeds a fingerprint that matches its own public key, and differs across keys', () => {
    const a = generateSigningKeyPair();
    const b = generateSigningKeyPair();
    const sigA = signChecksums('x  f\n', a.privateKeyPem, SIGNED_AT);
    expect(sigA.publicKeyFingerprint).toBe(publicKeyFingerprint(a.publicKeyPem));
    expect(publicKeyFingerprint(a.publicKeyPem)).not.toBe(publicKeyFingerprint(b.publicKeyPem));
  });

  it('rejects a signature whose fingerprint field was tampered', () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const body = 'abc123  manifest.json\n';
    const sig = signChecksums(body, privateKeyPem, SIGNED_AT);
    const tampered = { ...sig, publicKeyFingerprint: 'sha256:deadbeef' };
    const check = verifyChecksumsSignature(tampered, body);
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/fingerprint/i);
  });

  it('rejects malformed or wrong-algorithm signatures', () => {
    expect(verifyChecksumsSignature(null, 'x').valid).toBe(false);
    expect(verifyChecksumsSignature({ algorithm: 'rsa' }, 'x').valid).toBe(false);
    expect(verifyChecksumsSignature({ algorithm: 'ed25519', target: 'checksums.sha256' }, 'x').valid).toBe(false);
  });

  it('rejects a signature with any required field stripped or version mismatched', () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const body = 'abc123  manifest.json\n';
    const sig = signChecksums(body, privateKeyPem, SIGNED_AT);
    for (const field of ['digest', 'publicKeyFingerprint', 'digestAlgorithm', 'version'] as const) {
      const stripped: Record<string, unknown> = { ...sig };
      delete stripped[field];
      expect(verifyChecksumsSignature(stripped, body).valid).toBe(false);
    }
    expect(verifyChecksumsSignature({ ...sig, version: '999' }, body).valid).toBe(false);
  });
});

describe('signed export end to end', () => {
  const base = {
    source: 'claude-code' as const,
    sessionId: CLAUDE_SESSION_ID,
    cwd: CLAUDE_CWD,
    config: testConfig({ redactTerms: ['demo-project'] }),
    mode: 'sanitized' as const,
    includeRaw: false,
    allowSecrets: false,
    makeZip: false,
  };

  it('writes signature.json and validates as signed', async () => {
    const { privateKeyPem, publicKeyPem } = generateSigningKeyPair();
    const out = await tempExportRoot();
    const r = await exportSession({
      ...base, exportRoot: out, exportedAt: '2026-06-29T10-00-00.000Z', signingKeyPem: privateKeyPem,
    });
    expect((await readdir(r.bundleDir))).toContain('signature.json');
    expect(r.signatureFingerprint).toBe(publicKeyFingerprint(publicKeyPem));

    const v = await validateBundle(r.bundleDir);
    expect(v.ok).toBe(true);
    expect(v.signature).toBe('valid');
    expect(v.signerFingerprint).toBe(publicKeyFingerprint(publicKeyPem));
  });

  it('an unsigned export validates with signature "absent"', async () => {
    const out = await tempExportRoot();
    const r = await exportSession({ ...base, exportRoot: out, exportedAt: '2026-06-29T10-01-00.000Z' });
    expect((await readdir(r.bundleDir))).not.toContain('signature.json');
    const v = await validateBundle(r.bundleDir);
    expect(v.ok).toBe(true);
    expect(v.signature).toBe('absent');
    expect(v.signerFingerprint).toBeNull();
  });

  it('editing a file without touching checksums is caught by the checksum layer', async () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const out = await tempExportRoot();
    const r = await exportSession({
      ...base, exportRoot: out, exportedAt: '2026-06-29T10-02-00.000Z', signingKeyPem: privateKeyPem,
    });
    const transcript = r.files.transcript;
    await writeFile(transcript, (await readFile(transcript, 'utf8')) + '\nINJECTED\n');

    const v = await validateBundle(r.bundleDir);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /Checksum mismatch/i.test(e))).toBe(true);
    // checksums.sha256 itself is untouched, so the signature over it still verifies.
    expect(v.signature).toBe('valid');
  });

  it('editing a file AND repairing its checksum is caught only by the signature', async () => {
    const { privateKeyPem } = generateSigningKeyPair();
    const out = await tempExportRoot();
    const r = await exportSession({
      ...base, exportRoot: out, exportedAt: '2026-06-29T10-03-00.000Z', signingKeyPem: privateKeyPem,
    });
    const transcript = r.files.transcript;
    const tampered = (await readFile(transcript, 'utf8')) + '\nINJECTED\n';
    await writeFile(transcript, tampered);

    // Forge the checksums file so the integrity layer alone would pass.
    const checksumsPath = join(r.bundleDir, 'checksums.sha256');
    const repaired = (await readFile(checksumsPath, 'utf8')).replace(
      /^[0-9a-f]{64}(\s+session\.transcript\.md)$/m,
      `${sha256(tampered)}$1`,
    );
    await writeFile(checksumsPath, repaired);

    const v = await validateBundle(r.bundleDir);
    expect(v.errors.some((e) => /Checksum mismatch/i.test(e))).toBe(false); // integrity layer fooled
    expect(v.signature).toBe('invalid'); // provenance layer catches it
    expect(v.ok).toBe(false);
  });
});
