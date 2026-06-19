# 06: Task breakdown

Date: 2026-06-20. Status reflects actual work.

| # | Task | Owner | Status |
| --- | --- | --- | --- |
| 1 | Inspect env, skill format, Codex presence, AgentTrace schema | main | done |
| 2 | Session-format investigation (Claude + Codex), keys only | sub | done |
| 3 | Redaction + filesystem security review | sub | done |
| 4 | Portability review against AgentTrace's real parser | sub | done |
| 5 | Skill UX review | sub | done |
| 6 | Scaffold TS/Node, ESLint, Vitest, zero runtime deps | main | done |
| 7 | Normalized types + shared normalize helpers | main | done |
| 8 | Redaction rules + engine | main | done |
| 9 | Claude adapter (discover + normalize) | main | done |
| 10 | Codex adapter (experimental) + manual importer | main | done |
| 11 | Bundle: agenttrace emit, transcript, summary, manifest, report, readme, checksums, zip, writer | main | done |
| 12 | Validator | main | done |
| 13 | Security/paths (sanitize, containment, symlink, atomic) | main | done |
| 14 | Engine + config + discovery registry | main | done |
| 15 | CLI (discover/inspect/preview/export/import/validate, --json, prompts) | main | done |
| 16 | Synthetic fixtures (claude, codex, manual) | main | done |
| 17 | Tests (redaction, paths, egress, normalize, bundle, discovery, portability) | main | done |
| 18 | Claude Code skill + install doc | main | done |
| 19 | Docs (AgentTrace compatibility, offline Claude, codex investigation) | main | done |
| 20 | Final security audit | sub + main | pending |
| 21 | Planning docs + README | main | in progress |
| 22 | Verify build/test/lint/typecheck; commits (no push) | main | pending |

## Critical path

2,3,4 (reviews) -> 7,8 (model + redaction) -> 9 (claude) -> 11 (bundle) -> 15
(CLI) -> 17 (tests). The portability review (4) changed the bundle's normalized
format before it was written, which is why it ran first.

## Parallelism used

The four design subagents ran concurrently in the background while the main agent
scaffolded the project and wrote the types and redaction engine.
