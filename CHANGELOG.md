# Changelog

## [1.1.0] - 2026-06-29 - Provenance signing (post-submission addition)

Added after the original assessment submission (assessment-v1.0.0, 20 June 2026).
The submitted bundle already proved internal integrity with SHA-256 checksums;
this release adds cryptographic provenance so a reviewer can prove a bundle is
authentic and unaltered since export, not merely self-consistent.

- `sessionporter keygen` generates an ed25519 keypair (Node standard library
  only; no new dependencies). The private key never enters a bundle.
- `sessionporter export --sign --key <pem>` signs the bytes of
  `checksums.sha256` (which already lists every other file's hash) and writes a
  `signature.json` sidecar carrying the public key, its fingerprint, and the
  signature.
- `sessionporter verify <bundle> [--pubkey <sha256:...>]` requires a present,
  valid signature and can pin an expected signer fingerprint.
- `validate` now also reports signature status (`valid` / `invalid` / `absent`).

Threat model and design notes: `planning/13-provenance-signing.md`. Tests for
the new path are in `tests/signing.test.ts` plus a signed-export network
isolation case in `tests/security/egress.test.ts`. Signing is opt-in; unsigned
bundles behave exactly as before.
