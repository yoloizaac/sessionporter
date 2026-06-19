# 10: Problems and corrections

Date: 2026-06-20

Honest record of what went wrong and how it was fixed.

## Incorrect assumption: AgentTrace honours a flat category

The brief's suggested normalized schema is a flat event with a `category` field.
The initial plan was to emit it verbatim. The portability subagent read
AgentTrace's real parser and showed it ignores that field and re-derives category
from raw Claude block shapes, so the flat schema would have produced empty
analytics in AgentTrace. Correction: `session.normalized.jsonl` now emits
AgentTrace-native records with the normalized event in a `_sessionporter` sidecar.
Evidence: `docs/agenttrace-compatibility.md`, `tests/portability.test.ts`.

## Bug caught by tests: AWS key regex boundary

The first fixture used `AKIAFAKE1234567890ABCD` (18 characters after `AKIA`). The
rule is `AKIA[0-9A-Z]{16}\b`, which needs exactly 16 characters then a word
boundary, so the 18-character value did not match and the redaction test failed.
Correction: used a valid 20-character synthetic key (`AKIAIOSFODNN7EXAMPLE`) in the
fixture and tests. A too-short JWT test value was lengthened for the same reason.

## Bug caught by tests: sanitizeName did not fall back

`sanitizeName('///')` returned `---` instead of the fallback. Correction: strip
leading separators and require at least one alphanumeric character before
accepting the name, else return the fallback.

## Assumption corrected by the format investigation

A Claude session filename uuid is not always the internal `sessionId` (resume and
fork create new files). The adapter therefore reads `sessionId` from the records
and matches on it, falling back to the filename, so selection is correct under
resume/fork.

## Environment friction (not a code defect)

The host machine had 40+ orphaned Node processes from prior sessions, so Vitest's
default worker pool failed to spawn ("thread failed to start"). Running with a
bounded fork pool resolved it. The code and tests are unaffected; this is recorded
so the test command in the final report is reproducible.

## Human judgment that prevented overengineering

Hand-writing the ZIP writer and argument parser to keep zero runtime dependencies,
marking Codex experimental rather than claiming support, and keeping the redaction
report to counts and locations rather than building a richer (and riskier)
value-referencing report.
