# 07: Test plan

Date: 2026-06-20

All fixtures are synthetic (`fixtures/`), validated by `npm run validate:fixtures`
to contain only clearly-synthetic secrets. 62 tests across 7 files.

## Discovery (`tests/discovery.test.ts`)

Multiple sessions across slugs; metadata (project, cwd, record count, title); an
empty session counts zero; current-session resolution is heuristic and says so;
no match returns null; a missing directory reports unavailable and discovers
nothing.

## Parsing / normalization (`tests/normalize.test.ts`)

Claude: every expected category; malformed line warns and the rest parse;
verification labelled inferred and `npm test` detected; tool_use/tool_result id
linkage; error status failure; missing timestamp stays null; unknown type
preserved; stable unique ids and sequence; Unicode preserved.
Codex: `event_msg` duplicates and meta/turn_context skipped; shell call to
command + verification; failing output to error; encrypted reasoning not exposed;
experimental warning.
Manual: roles inferred from Markdown headings and labelled inferred.

## Redaction (`tests/security/redaction.test.ts`)

API keys (sk/gh/AKIA/AIza/xox/glpat), bearer, cookie, JWT, PEM private key,
password, env secret, connection string (host kept), git remote, email
(sanitized vs private), Windows/POSIX home, user term, public vs private IP,
resembles-but-not-secret, idempotency, private-mode floor, and the report-safety
test (counts and locations only, never a value).

## Bundle security (`tests/bundle.test.ts`, `tests/security/paths.test.ts`)

Path traversal and absolute-escape rejection; filename sanitization; atomic write
and symlink-safe assertion; existing-destination refusal; checksum validation and
self-exclusion; zip contents equal the written files; private raw present only in
private mode and absent in sanitized; manifest validates; manual import produces a
valid bundle; redaction applied across normalized and transcript.

## Portability (`tests/portability.test.ts`)

AgentTrace-native emission per category (tool_use with id/name/input, tool_result
linked by tool_use_id, is_error, ExitPlanMode plan, summary record, string user
content) and the `_sessionporter` sidecar always present.

## Network isolation (`tests/security/egress.test.ts`)

A full export runs while `http`/`https`/`net`/`dns`/`fetch` are trapped; the test
fails if any is called. None are.

## Commands

`npm run build`, `npm test`, `npm run lint`, `npm run typecheck`,
`npm run test:security`, `npm run validate:fixtures` must all pass.
