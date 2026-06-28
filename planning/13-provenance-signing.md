# 13. Provenance signing (post-submission addition, 2026-06-29)

## Why

The bundle already carries `checksums.sha256`, which lets a reviewer confirm the
files are internally consistent. But checksums are public and recomputable: an
edited bundle whose checksums file is also rewritten passes integrity validation.
For a tool whose stated purpose is *evidence of AI-assisted development* meant for
*independent audit*, that gap matters. Provenance signing closes it.

## What is signed, and why that is enough

The signature covers the exact bytes of `checksums.sha256`. That one file lists
the SHA-256 of every other file in the bundle (`manifest.json`, the normalized
JSONL, the transcript, the redaction report, the README, and the raw log in
private mode). So:

- Edit any covered file but not the checksums file -> the file's recomputed hash
  no longer matches its line in `checksums.sha256`. The existing checksum layer
  fails. (Test: "editing a file without touching checksums".)
- Edit a covered file and repair its line in `checksums.sha256` -> integrity
  passes, but the signed bytes have changed, so the signature no longer verifies.
  Forging it requires the private key. (Test: "editing a file AND repairing its
  checksum".)

Two non-covered sidecars are excluded by necessity: `checksums.sha256` cannot
list itself, and `signature.json` is derived from the checksums and so cannot be
inside them.

## Mechanism

- ed25519 via Node's standard-library `crypto`. No new runtime dependencies,
  preserving the project's zero-dependency posture.
- `keygen` writes a PKCS8 private key (0600) and an SPKI public key. The private
  key is never written into a bundle.
- `export --sign` writes `signature.json`: `{ algorithm, target, digest,
  publicKey (PEM), publicKeyFingerprint (sha256 of the DER), signature (base64),
  signedAt }`.
- `verify` recomputes the checksums-file digest, checks the embedded fingerprint
  matches its own key, then verifies the ed25519 signature. `--pubkey` pins an
  expected signer.

## Honest limitations

- The public key is embedded in the bundle, so a signature proves **tamper-
  evidence** (the bundle is unchanged since it was signed by the holder of some
  key), not **identity** on its own. Identity comes from pinning a known
  fingerprint out of band (`verify --pubkey sha256:...`). This is the same trust
  model as an unverified PGP key: trust is established by the fingerprint you
  already know, not by the key travelling with the artifact.
- Signing is opt-in. An unsigned bundle reports `signature: absent` and is not an
  error; `verify` (as opposed to `validate`) is the command that *requires* a
  signature.
- `signedAt` is informational and not itself a trusted timestamp (no TSA).
