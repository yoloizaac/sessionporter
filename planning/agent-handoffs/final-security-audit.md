# Final Security Audit — SessionPorter

Date: 2026-06-20
Auditor: final-security-auditor (subagent)
Scope: analysis only. No source modified. Read-only commands and the project's own scripts were run.

## Verdict: GO

SessionPorter passes every checklist item. The tool is local-first with zero network egress, never executes session content, never persists analytics/telemetry, and never commits real secrets or session logs. All 62 tests pass. The only findings are Low-severity and are already disclosed limitations (heuristic redaction false negatives), plus one Info note about the repo having no initial commit yet.

## Command results

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) | PASS, no output/errors |
| `npm run lint` (`eslint .`) | PASS, no warnings/errors |
| `npm run build` (`tsc -p tsconfig.build.json`) | PASS, emitted to `dist/` |
| `npx vitest run --pool=forks --poolOptions.forks.maxForks=2` | PASS, 7 files, **62 tests passed** (egress 1, bundle 10, normalize 14, discovery 6, paths 8, redaction 16, portability 7) |
| `npm run validate:fixtures` | PASS, "Fixture validation OK: 4 files, all secret-shaped values are synthetic." |
| `git status --porcelain` | No export bundle / raw log staged or committable (see item 7) |

## Checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | No network / no egress | PASS | Grep of `src/` for `fetch(`, `http`, `https`, `net`, `dns`, `WebSocket`, `XMLHttpRequest`, `request(`, `node:tls`, `.connect(` returned **no matches**. The only network references in the repo are in the egress *test*. `tests/security/egress.test.ts:10-46` drives a full `exportSession` (claude-code, sanitized, zip) with `vi.spyOn` traps on `http.request`, `https.request`, `net.connect`, `dns.lookup`, and `globalThis.fetch`, asserting all five `not.toHaveBeenCalled()` and `validation.ok === true`. |
| 2 | No replay / no execution | PASS | Grep for `child_process`, `exec`, `spawn`, `eval(`, `new Function`, `vm`, dynamic `import(` found **no executable call sites**. The single `exec` hit (`src/normalize/shared.ts:88`) is a string literal inside `COMMAND_TOOLS`, a `Set` used only to *classify* a transcript tool by name, never to run it. Session commands are stored as data (`command` field) and rendered into Markdown/JSONL; no URL from a transcript is fetched or opened. |
| 3 | No storage / analytics / telemetry | PASS | Grep for `localStorage`, `sessionStorage`, `analytics`, `telemetry`, `navigator.`, `posthog`, `segment`, `mixpanel`, `sentry`: only two benign hits — a comment in `src/bundle/agenttrace.ts:4` ("tool-usage analytics") and the literal Codex record type `"telemetry"` handled as an unknown/future field. No storage or telemetry APIs. |
| 4 | Redaction soundness | PASS (with disclosed Low-severity false negatives) | `src/redact/rules.ts`: `ALWAYS` credential rules run in both modes; `rulesFor('private', ...)` returns `[...ALWAYS]` only (line 152), so private mode still blocks keys/PEM/connection-strings/bearer/JWT/env-secrets/passwords. `src/bundle/redactionReport.ts` prints only category, count, and event sequence numbers (lines 50-56), never a value — the header explicitly states this (line 35) and `tests/security/redaction.test.ts:103-117` asserts the summary blob contains no original value. Idempotency verified: replacement tokens are `[REDACTED_*]`; my own probe re-redacted `[REDACTED_API_KEY] sk-FAKEKEY…` and got `[REDACTED_API_KEY] [REDACTED_API_KEY]` with the existing token untouched (test at `redaction.test.ts:83-87`). |
| 5 | Filesystem safety | PASS | `src/security/paths.ts`: `assertWithin` (21-30) blocks traversal/absolute escape via `relative()` check; `assertNotSymlink` (33-43) refuses symlinks; `atomicWrite` (51-57) writes to a random temp file then `rename` (atomic), mode `0o600`; dirs created `0o700`. `src/bundle/writer.ts`: refuses to overwrite an existing export (`OUTPUT_EXISTS`, 54-60), routes every write through `assertWithin(bundleDir, name)` (121), warns when inside a git tree (62-65). `src/bundle/checksums.ts:13-20` builds `checksums.sha256` over content+manifest only, never itself; `src/validate/validate.ts:37-39` actively errors if the file lists itself. `src/bundle/zip.ts:36-38` rejects any entry name containing `/`, `\`, or `..`, and entry names are controlled basenames, so the OUTPUT zip cannot zip-slip. |
| 6 | Fixtures are synthetic | PASS | All four fixtures use synthetic markers only: `sk-FAKEKEY*`, `devuser@example.com`, `AKIAIOSFODNN7EXAMPLE` (AWS public doc example), `db.example.com`, `/home/devuser`, `ENCRYPTED-BLOB-NOT-RECOVERABLE`. `scripts/validate-fixtures.ts` scans every fixture for nine credential shapes and fails unless each match is near a `SYNTHETIC_MARKERS` token (line 11, 45). `npm run validate:fixtures` passed. The empty fixture is genuinely empty (1 blank line). No real `.jsonl` session logs present; the only real-looking `.jsonl` are these synthetic fixtures. |
| 7 | Git hygiene | PASS | `.gitignore` ignores `.sessionporter/`, `*.sessionporter.zip`, `session.raw.json`, `session.raw.jsonl`, `.env`, `.env.*`, and `.sessionporter.json` (lines 8-17). `git check-ignore` confirmed every one of these patterns is honored, including `.sessionporter/exports/foo`. An earlier smoke export exists on disk at `.sessionporter/exports/sessionporter-claude-code-…/` plus its `.zip`, but `git status --porcelain` does **not** list it and `git ls-files` shows zero tracked files matching `sessionporter/exports|session.raw|.zip`. No bundle or raw log is committable. |
| 8 | Private-raw discipline | PASS | `session.raw.jsonl` is only written when `mode === 'private'` (`src/bundle/writer.ts:85`). The validator errors if a sanitized bundle contains `session.raw.*` (`src/validate/validate.ts:64-68`), and `writeBundle` throws on validation failure (132-135). Private mode requires explicit confirmation: interactive must type exactly `CONFIRM PRIVATE` (`src/cli/index.ts:239-240`), non-interactive requires `--confirm-private` (250-251). `includeRaw` is bound to `mode === 'private'` at the CLI (264) and `importTranscript` hardcodes `includeRaw: false`. Disabling redaction (`allowSecrets`) is rejected outside private mode (`src/core/engine.ts:138-139`, `UNSAFE_REQUIRES_PRIVATE`). |

## Findings (severity-ranked)

### Low-1 — Heuristic redaction misses unprefixed / unknown-format secrets (disclosed)
Adversarial probe against the built `dist/` redactor (sanitized mode) showed these pass through unredacted:
- Bare high-entropy hex/base64 blobs with no recognized key name (e.g. a 40-char hex token introduced only by the word "token").
- Stripe `sk_live_…` keys (only `sk-…` with a hyphen is covered, not `sk_live_`/`sk_test_` underscore prefixes).
- Slack incoming-webhook URLs (`https://hooks.slack.com/services/…`).
- Oddly named env secrets whose key does not contain SECRET/TOKEN/KEY/PASSWORD/etc.

This is an accepted, documented limitation: `src/redact/rules.ts` header comment, the per-category notes in `src/bundle/redactionReport.ts:12-14` ("Misses unknown vendor formats (false negative)"), and the report's Manual-Review section all tell the user that detection is heuristic and the transcript must be reviewed before sharing. Not a regression; no fix required for go/no-go. Optional hardening: add `sk_live_`/`sk_test_` and a generic high-entropy heuristic if false-positive cost is acceptable.

### Info-1 — Repository has no initial commit yet
`git log` reports "your current branch 'main' does not have any commits yet"; all files are untracked (`??`). Because `.gitignore` is already in place and correct, the pending first commit will not capture any export bundle or raw log. No action needed beyond making that first commit with the existing `.gitignore` present (which it is).

## Egress / synthetic-fixtures / git-hygiene confirmation
- No egress: confirmed by grep (zero network I/O in `src/`) and by the egress test that traps http/https/net/dns/fetch across a full export and asserts none fire.
- Synthetic fixtures: confirmed by inspection and by `validate:fixtures` (4 files, all secret shapes synthetic); no real session logs present.
- Git hygiene: confirmed by `.gitignore`, `git check-ignore` on every required pattern, and `git status` / `git ls-files` showing the smoke-export bundle and zip are ignored and untracked.

Signed,
final-security-auditor (subagent)
