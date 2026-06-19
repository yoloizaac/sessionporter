# 09: Agent contributions

Date: 2026-06-20

## Subagents

Four design subagents ran in parallel before implementation, plus a final security
auditor after. Each left a handoff in `planning/agent-handoffs/`.

- **session-format-investigator**: sampled the real Claude (about 1,188 files) and
  Codex session structures (keys only, no content). Produced the type taxonomy
  and the mapping that drove both adapters, and the completeness limits (Claude
  `thinking` plaintext but signed; Codex reasoning encrypted; dual Codex channels;
  filename uuid not always the sessionId). Accepted wholesale.
- **redaction-security-reviewer**: produced the ordered redaction ruleset, the
  report-safety rule (counts and locations only), and the filesystem threat model
  (traversal, zip slip, symlink, overwrite, git-dir, atomic writes, permissions),
  plus the security test list. Accepted; shaped `src/redact` and `src/security`.
- **portability-reviewer**: read AgentTrace's parser and found the flat-`category`
  incompatibility, which changed the normalized output format before it was
  written. The single most consequential finding.
- **skill-ux-reviewer**: defined the SKILL.md conventions, the minimal decision
  tree, the `--json` envelope contract, and the success/failure messages. Shaped
  the CLI's `--json` mode and the skill.
- **final-security-auditor**: ran after implementation (see
  `planning/agent-handoffs/final-security-audit.md`).

## What the main agent accepted, modified, rejected

- Accepted: every format mapping, the redaction ruleset and ordering, the
  filesystem defenses, the `--json` contract, and the AgentTrace-native decision.
- Modified: kept the redaction report to category + count + sequence (the reviewer
  also suggested file/event references; sequence is the cleanest given one session
  per bundle).
- Rejected: pulling a ZIP or CLI dependency (hand-wrote both to keep zero runtime
  deps); claiming Codex "supported" (kept it experimental).

## Where AI accelerated the work

Running four investigations concurrently meant the redaction ruleset, the format
mappings, and the AgentTrace-compatibility correction all arrived before the
engine was written, so the implementation was right the first time on the
high-risk parts rather than reworked.
