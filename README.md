# SessionPorter

**Export one AI coding session into a portable, reviewable, privacy-aware bundle.**

SessionPorter is a local-first CLI (plus a Claude Code skill) that takes one
selected AI coding session and produces files you can:

- upload into **AgentTrace**;
- upload into a separate **offline Claude conversation** for an independent audit;
- read as a human transcript;
- keep as evidence of AI-assisted development;
- safely share after redaction.

It runs entirely on your machine. No network, no analytics, no telemetry, no
external AI, and **no runtime dependencies** (only Node's standard library). It
exports records; it never executes or replays them.

## Assessment submission

Demo video and submission details: [`SUBMISSION.md`](./SUBMISSION.md). The
3.5 minute [demo video](https://github.com/yoloizaac/sessionporter/releases/tag/assessment-v1.0.0)
is a Release asset. Working notes and agent handoffs are in
[`planning/`](./planning/); the sanitized agent-session evidence is in
[`planning/agent-logs/sessionporter-build/`](./planning/agent-logs/sessionporter-build/);
the final security audit is
[`planning/agent-handoffs/final-security-audit.md`](./planning/agent-handoffs/final-security-audit.md).

## Sources

| Source | Status |
| --- | --- |
| Claude Code (`~/.claude/projects/**`) | supported |
| Codex CLI (`~/.codex/sessions/**`) | experimental (fixture-tested; see `planning/codex-adapter-investigation.md`) |
| Manual transcript (JSONL / JSON / Markdown / text) | supported fallback |

## Install and build

```
npm install
npm run build
# optional: npm link  (puts `sessionporter` on PATH)
```

Requires Node 20+.

## Quick start

```
sessionporter discover
sessionporter export --source claude --current
```

```
Potential sensitive values detected:
  2 email
  4 home_path
  1 api_key

Continue with sanitized export? [Y/n]

Review before sharing:  .sessionporter/exports/.../REDACTION_REPORT.md
Upload to AgentTrace:    .sessionporter/exports/.../session.normalized.jsonl
Offline Claude:          .sessionporter/exports/.../session.transcript.md
Complete bundle:         .sessionporter/exports/....zip
```

## Commands

```
sessionporter discover [--source claude|codex] [--recent <days>] [--here] [--query <q>] [--json]
sessionporter inspect --source claude --session <id>
sessionporter redact-preview --source claude --session <id> [--mode sanitized|private]
sessionporter export --source claude --session <id> [--mode sanitized|private] [--out <dir>] [--no-zip] [--json] [--yes]
sessionporter export --source claude --current
sessionporter import-transcript <file> [--mode sanitized]
sessionporter validate <bundle-path>
```

Scripts: `npm run build | test | lint | typecheck | test:security | validate:fixtures`.

## The bundle

`session.normalized.jsonl` (AgentTrace), `session.events.jsonl` (flat normalized),
`session.transcript.md` (offline Claude), `session.summary.md`, `manifest.json`,
`REDACTION_REPORT.md`, `README.md`, `checksums.sha256`, optional `bundle.zip`, and
`session.raw.jsonl` only in private mode. Details in `planning/04-bundle-format.md`.

## Privacy and security

- **Sanitized by default.** Private mode keeps more content, requires explicit
  confirmation, still blocks credentials and private keys, and is never reached by
  a silent fallback.
- Redacts API keys, tokens, cookies, JWTs, private keys, passwords, connection
  strings, env secrets, emails, home directories, and public IPs. The redaction
  report shows category and count only, never a value.
- Path-traversal containment, symlink refusal, atomic writes, overwrite refusal,
  and self-excluding checksums.
- Exports are written to `.sessionporter/exports/` (git-ignored). A test proves a
  full export performs zero network calls.

Details: `planning/03-redaction-model.md`, `docs/agenttrace-compatibility.md`,
`docs/offline-claude-usage.md`.

## Architecture

Three layers: a thin CLI, a tool-independent engine (resolve, read, normalize,
redact, bundle, validate), and thin per-source adapters. Strict TypeScript, ESM,
zero runtime dependencies. See `planning/05-architecture.md`.

## AI-agent development

Built with Claude Code and four parallel review subagents (session format,
redaction security, AgentTrace portability, skill UX) plus a final security
auditor. Handoffs are in `planning/agent-handoffs/`. The honest account of where
AI helped and one mistake it had to correct is in
`planning/09-agent-contributions.md` and `planning/10-problems-and-corrections.md`.

## Limitations

- Current-session resolution is a documented heuristic (a CLI cannot see the
  invoking session id).
- Hidden or encrypted model reasoning is not reconstructed (Codex reasoning is
  encrypted; Claude `thinking` is included where present).
- Redaction is heuristic: review the report and skim the transcript before
  sharing.
- Codex coverage is experimental and fixture-tested, not exhaustive.

## Evidence map

| Topic | Where |
| --- | --- |
| Planning | `planning/00`..`12` |
| Agent handoffs | `planning/agent-handoffs/` |
| Normalized model | `src/types/index.ts`, `planning/02-normalized-schema.md` |
| Redaction | `src/redact/`, `planning/03-redaction-model.md` |
| Bundle | `src/bundle/`, `planning/04-bundle-format.md` |
| Tests (62) | `tests/`, `planning/07-test-plan.md` |
| AgentTrace compatibility | `docs/agenttrace-compatibility.md` |
| Offline Claude usage | `docs/offline-claude-usage.md` |
| Codex investigation | `planning/codex-adapter-investigation.md` |
| Final audit | `planning/12-final-audit.md` |

## License

MIT. See `LICENSE`.
