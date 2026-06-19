# 03: Redaction model

Date: 2026-06-20. Grounded in the redaction-security-review handoff.

## Layered, ordered pipeline

Rules run in a fixed order so overlapping patterns do not corrupt each other, and
the replacement tokens (`[REDACTED_*]`) never re-match a later rule (idempotent).
Implemented in `src/redact/rules.ts` and applied by `src/redact/redactor.ts` to
each event's content, command, filePath, and title.

Order: private key (PEM) -> connection-string credentials -> bearer/authorization
-> cookie -> JWT -> env secret (key-name based) -> password -> vendor API keys ->
then sanitized-only identity rules (user terms, email, home directory, public IP).

## Always-on rules (run in every mode, including private)

Private keys, connection-string and git-remote credentials, bearer tokens,
cookies, JWTs, env secrets (`*SECRET*`/`*TOKEN*`/`*API_KEY*`/... = value),
password fields, and vendor key shapes (`sk-`, `gh[posru]_`, `github_pat_`,
`AKIA…`, `AIza…`, `xox[baprs]-`, `glpat-`). Private mode keeps more content but
never leaks these.

## Sanitized-only rules

Emails, Windows/POSIX home-directory names (prefix kept, user name replaced),
user-supplied terms from `.sessionporter.json`, and public IPv4 (private and
loopback ranges are kept because they aid readability and are not sensitive).

## Honesty rule

`REDACTION_REPORT.md` lists category, count, and the affected event sequence
numbers only. It never prints an original value, not even partially or hashed, and
it documents false-positive and false-negative risks per category.

## Known false positives / negatives

- `password=` may over-match the literal word in prose (false positive).
- Email/home redaction may remove non-sensitive values (acceptable for sharing).
- Vendor-prefix matching misses unknown key formats (false negative), which is why
  the report always recommends a manual skim before sharing.

## The deliberate override

Disabling the always-on rules is only possible in private mode via an explicit
`--allow-secrets` flag (rejected otherwise with `UNSAFE_REQUIRES_PRIVATE`). There
is no easy `--no-redaction`, and sanitized never silently falls back to private.
