# 04: Bundle format

Date: 2026-06-20

A timestamped folder `sessionporter-<source>-<safe-name>-<timestamp>/` plus an
optional sibling `.zip`. Files:

| File | Purpose |
| --- | --- |
| `session.normalized.jsonl` | AgentTrace upload (AgentTrace-native records + `_sessionporter` sidecar). |
| `session.events.jsonl` | SessionPorter's flat normalized events (tool-independent). |
| `session.transcript.md` | Human transcript for an offline Claude conversation. Pure evidence; mechanical appendix separated. |
| `session.summary.md` | Deterministic counts (no AI, no quality score). |
| `manifest.json` | schemaVersion, exporterVersion, source, hashed session id (sanitized), mode, eventCount, file list, content checksums, redaction summary, warnings, completeness. |
| `REDACTION_REPORT.md` | Category + count + event locations. Never the values. |
| `README.md` | What each file is, which to upload where, limitations, safe-sharing checklist. |
| `checksums.sha256` | SHA-256 of every other file (never itself). |
| `session.raw.jsonl` | Private mode only: the original records. |
| `bundle.zip` | Optional archive of all files, after validation. |

## Integrity

- `checksums.sha256` covers all files except itself (no recursive self-checksum).
- `manifest.json.checksums` covers the content files (it cannot contain its own
  hash); `checksums.sha256` covers the manifest too.
- The validator (`sessionporter validate`) reads the checksums, re-hashes every
  file, verifies the manifest file list, confirms `session.normalized.jsonl`
  parses, and confirms a sanitized bundle contains no raw file.

## Truncation

Tool outputs beyond `maxToolOutputCharacters` are cut with an explicit
`[TRUNCATED BY SESSIONPORTER: …]` marker and counted in the summary and manifest.
Nothing is truncated silently.

## Atomic, contained writes

Every file is written to a temp name then renamed, with restrictive permissions,
refusing to follow symlinks, and every path is asserted to stay inside the bundle
directory (no traversal). An existing export is never overwritten.
