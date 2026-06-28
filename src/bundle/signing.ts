/** Optional provenance signing. Signs the bytes of `checksums.sha256` with an
 * ed25519 key (Node standard library only). Because that file already lists the
 * SHA-256 of every other bundle file, a valid signature proves the whole bundle
 * is authentic and unaltered since export, not merely internally consistent. The
 * private key is never written into a bundle; only the public key and signature
 * are. This module is pure crypto (no filesystem) so it is trivially testable. */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

export const SIGNATURE_FILE = 'signature.json';
export const SIGNATURE_VERSION = '1';
/** The file whose exact bytes are signed. It transitively covers all others. */
export const SIGNED_TARGET = 'checksums.sha256';

export interface BundleSignature {
  version: string;
  algorithm: 'ed25519';
  target: string;
  digestAlgorithm: 'sha256';
  /** sha256(target bytes), hex. Transparency only; verification re-derives it. */
  digest: string;
  /** PEM (SPKI) public key, embedded so a reviewer can verify with no key exchange. */
  publicKey: string;
  /** 'sha256:<hex>' of the DER public key, for out-of-band signer pinning. */
  publicKeyFingerprint: string;
  /** base64 ed25519 signature over the target bytes. */
  signature: string;
  signedAt: string;
}

export interface KeyPairPem {
  privateKeyPem: string;
  publicKeyPem: string;
}

/** Generate an ed25519 keypair as PEM (PKCS8 private, SPKI public). */
export function generateSigningKeyPair(): KeyPairPem {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

/** Stable fingerprint of a public key: sha256 over its DER (SPKI) bytes. */
export function publicKeyFingerprint(publicKey: KeyObject | string): string {
  const key = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
  const der = key.export({ type: 'spki', format: 'der' });
  return 'sha256:' + createHash('sha256').update(der).digest('hex');
}

function assertEd25519(key: KeyObject): void {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Signing key must be ed25519, got ${key.asymmetricKeyType ?? 'unknown'}.`);
  }
}

/** Sign the bytes of the checksums file. Returns the signature sidecar object. */
export function signChecksums(checksumsBody: string, privateKeyPem: string, signedAt: string): BundleSignature {
  const privateKey = createPrivateKey(privateKeyPem);
  assertEd25519(privateKey);
  const publicKey = createPublicKey(privateKey);
  const data = Buffer.from(checksumsBody, 'utf8');
  const signature = sign(null, data, privateKey);
  return {
    version: SIGNATURE_VERSION,
    algorithm: 'ed25519',
    target: SIGNED_TARGET,
    digestAlgorithm: 'sha256',
    digest: createHash('sha256').update(data).digest('hex'),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    publicKeyFingerprint: publicKeyFingerprint(publicKey),
    signature: signature.toString('base64'),
    signedAt,
  };
}

export interface SignatureCheck {
  valid: boolean;
  reason: string | null;
  fingerprint: string | null;
}

/** Verify a signature sidecar (untrusted input) against the actual checksums bytes. */
export function verifyChecksumsSignature(sig: unknown, checksumsBody: string): SignatureCheck {
  if (!sig || typeof sig !== 'object') {
    return { valid: false, reason: 'signature.json is not an object.', fingerprint: null };
  }
  const s = sig as Partial<BundleSignature>;
  // Every declared field is required. A missing field must never weaken a check
  // (e.g. dropping `digest` to skip the transparency comparison).
  if (s.version !== SIGNATURE_VERSION) {
    return { valid: false, reason: `Unsupported signature version: ${String(s.version)}.`, fingerprint: null };
  }
  if (s.algorithm !== 'ed25519') {
    return { valid: false, reason: `Unsupported signature algorithm: ${String(s.algorithm)}.`, fingerprint: null };
  }
  if (s.digestAlgorithm !== 'sha256') {
    return { valid: false, reason: `Unsupported digest algorithm: ${String(s.digestAlgorithm)}.`, fingerprint: null };
  }
  if (s.target !== SIGNED_TARGET) {
    return { valid: false, reason: `Signature target is not ${SIGNED_TARGET}.`, fingerprint: null };
  }
  if (typeof s.publicKey !== 'string' || typeof s.signature !== 'string') {
    return { valid: false, reason: 'signature.json is missing publicKey or signature.', fingerprint: null };
  }
  if (typeof s.publicKeyFingerprint !== 'string' || s.publicKeyFingerprint.length === 0) {
    return { valid: false, reason: 'signature.json is missing publicKeyFingerprint.', fingerprint: null };
  }
  if (typeof s.digest !== 'string') {
    return { valid: false, reason: 'signature.json is missing digest.', fingerprint: null };
  }
  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey(s.publicKey);
    assertEd25519(publicKey);
  } catch (err) {
    return { valid: false, reason: `Invalid public key: ${(err as Error).message}`, fingerprint: null };
  }
  const fingerprint = publicKeyFingerprint(publicKey);
  // A tampered fingerprint field must not pass: it has to match its own key.
  if (s.publicKeyFingerprint !== fingerprint) {
    return { valid: false, reason: 'publicKeyFingerprint does not match the embedded public key.', fingerprint };
  }
  const data = Buffer.from(checksumsBody, 'utf8');
  // The transparency digest must match the real checksums bytes.
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== s.digest) {
    return { valid: false, reason: 'checksums digest does not match the signed digest.', fingerprint };
  }
  let ok = false;
  try {
    ok = verify(null, data, publicKey, Buffer.from(s.signature, 'base64'));
  } catch (err) {
    return { valid: false, reason: `Signature verification error: ${(err as Error).message}`, fingerprint };
  }
  return {
    valid: ok,
    reason: ok ? null : 'Signature does not match the checksums content (bundle altered or wrong key).',
    fingerprint,
  };
}
