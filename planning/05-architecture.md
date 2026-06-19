# 05: Architecture

Date: 2026-06-20

## Three layers

1. **Core CLI** (`src/cli/`): argument parsing, interactive prompts, and the
   `--json` envelope. No business logic.
2. **Engine** (`src/core/engine.ts`): the tool-independent pipeline (resolve ->
   read -> normalize -> redact -> bundle -> validate).
3. **Adapters** (`src/adapters/{claude,codex,manual}`): the only tool-specific
   code. Each discovers, reads, and normalizes one source.

## Data flow

```
adapter.discover / resolveCurrent / getSession  ->  SessionMeta
adapter.readRecords (streaming, size-capped)    ->  RawRecord[]
adapter.normalize                               ->  NormalizedEvent[]  (+ warnings)
redactEvents (mode, config)                     ->  redacted events + RedactionSummary
writeBundle                                     ->  files + checksums + zip
validateBundle                                  ->  pass/fail (export fails loudly)
```

Adapters are thin; redaction, bundling, and validation are shared and know
nothing about Claude or Codex.

## Module map

```
src/
  types/           the normalized model, adapter interface, limits, config types
  core/            errors, jsonl streaming, config, analyze, engine
  discovery/       adapter registry
  adapters/        claude | codex | manual  (discover + normalize)
  normalize/       shared helpers (flatten, tool classification, hashing)
  redact/          rules + redactor
  bundle/          agenttrace, transcript, summary, manifest, redactionReport,
                   readme, checksums, zip, writer
  validate/        bundle validator
  security/        paths (sanitize, containment, symlink refusal, atomic write)
  cli/             arg parsing + output
```

## Choices

- TypeScript on Node, strict, ESM (NodeNext). Matches the local Claude Code
  ecosystem.
- **Zero runtime dependencies.** Streaming JSONL via `node:readline`, ZIP via a
  hand-written writer over `node:zlib`, hashing via `node:crypto`. A security tool
  with no supply chain is easier to trust and audit.
- No database, no server, no frontend. A CLI plus a skill is sufficient.
- Large files are streamed line-by-line and capped; individual events are
  truncated with a marker.
