# SessionPorter — Redaction & Security Review (handoff)

Date: 2026-06-20
Author: redaction-security-reviewer (subagent)
Status: analysis only, pre-implementation. No code written.
Scope: redaction ruleset, honesty rule, bundle/filesystem threats, no-replay/no-egress, private-mode safeguards, security test list.

---

## 0. Threat model in one paragraph

SessionPorter ingests **untrusted local data** (Claude Code / Codex `.jsonl` session logs) and produces a **portable bundle the user intends to share**. The two failure classes that matter most are: (1) **leak** — a secret survives into a sanitized bundle the user then posts publicly; and (2) **footgun on the host** — the tool, while processing attacker-influenced log content, writes outside its export dir, follows a symlink, clobbers real files, executes logged commands, or phones home. The session content is adversarial input: a log can contain a filename like `../../.ssh/authorized_keys`, a fake URL, an HTML payload, or a crafted bundle name. Treat every string read from a `.jsonl` as hostile. The tool's job is to be **boringly inert**: read, normalize, redact, write to one sandboxed dir, never act on what the log says.

Trust boundaries:
- **Input boundary**: the `.jsonl` files (untrusted). Everything downstream must assume injection.
- **Output boundary**: `.sessionporter/exports/<bundle>/` (the only place we write).
- **Mode boundary**: sanitized (default) vs private vs `--no-redaction` (must be hard to reach).

---

## 1. Redaction ruleset

### 1.1 Layered design (defense in depth)

Run these layers in order; each is a net the previous one's misses fall into:

1. **Structured field-name match (highest precision).** When a normalized event has typed fields (env var pairs, tool-call args, HTTP header objects, parsed JSON), match on the *key*: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `api_key`, `apikey`, `token`, `access_token`, `refresh_token`, `secret`, `client_secret`, `password`, `passwd`, `pwd`, `private_key`, `aws_secret_access_key`, `session`, `sessionid`. Redact the value wholesale regardless of its shape. This catches secrets that have no recognizable pattern (e.g. a random 12-char DB password) which pure regex never will.
2. **Pattern match (regex) over free text.** For prose, code blocks, command output, and any value not caught structurally. Patterns in 1.3.
3. **Optional entropy check (opt-in, off by default).** For tokens that look secret-ish but match no known vendor prefix: flag base64/hex runs of length ≥ 32 with Shannon entropy above a threshold (≈ 4.0 bits/char for base64, ≈ 3.5 for hex). Off by default because it false-positives on hashes, UUIDs, git SHAs, and minified code. When on, it should **flag for review**, not silently redact, in sanitized mode it may redact; surface the count separately so the user can audit.
4. **User-supplied terms (deny list).** A `--redact-terms` flag / config list of literal strings (project codenames, client names, internal hostnames, the user's real name). Matched case-insensitively, whole-token, escaped as literals (never interpolated into a regex). This is how the user covers the long tail we cannot pattern-match.

Also apply, independent of layer: a **never-allow list** that fires in *every* mode including private and `--no-redaction` (see §5): `-----BEGIN ... PRIVATE KEY-----` blocks and a small set of unambiguous live-credential prefixes.

### 1.2 Ordering (so overlapping patterns do not corrupt each other)

Redaction is a sequence of replacements over the same text. Order matters because an early broad replacement can eat the anchor a later pattern needs, and a late one can re-match a token we already inserted. Rules:

- **Run multi-line / block patterns first**, before any line- or token-level pattern. Specifically PEM private-key blocks (greedy `BEGIN…END`) must run before anything else, otherwise base64 lines inside the key get individually mangled into `[REDACTED_*]` and the block boundary is lost.
- **Then run "structured prefix" key patterns** (connection strings, git remotes with creds, bearer/authorization, cookies, JWT) — these have surrounding context (`postgres://`, `Authorization:`, `https://user:pass@`) that must still be intact.
- **Then vendor-prefixed API keys** (`sk-`, `ghp_`, `AKIA…`, `AIza…`, `xox*`) — high precision, low collision.
- **Then generic / entropy / `KEY=VALUE` `.env`** patterns — broadest, highest false-positive, must run last so the precise ones win.
- **Then PII / environment patterns** (emails, home dirs, absolute paths, IPs) — these are the *least* sensitive and most false-positive-prone, so they run last and only on what survives.
- **Idempotency guard**: the replacement tokens themselves (`[REDACTED_*]`) must never be re-matched. Make every pattern reject the literal `[REDACTED_` prefix (negative lookbehind/around), or operate on an immutable copy and apply all replacements via non-overlapping span collection (preferred: collect `(start,end,token)` spans from all patterns, sort, drop overlaps keeping the higher-priority pattern, then splice once). The single-splice approach is the robust way to avoid corruption entirely — strongly recommended over sequential `re.sub` chaining.

### 1.3 Concrete patterns, tokens, and risk

Notation: patterns are illustrative (Python `re`, case-sensitive unless noted). Tune and test against fixtures. "FP" = false positive risk, "FN" = false negative risk.

| # | Category | Pattern (illustrative) | Replacement token | FP / FN notes |
|---|---|---|---|---|
| 1 | PEM private key block | `-----BEGIN (?:RSA \|EC \|OPENSSH \|DSA \|PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA \|EC \|OPENSSH \|DSA \|PGP )?PRIVATE KEY-----` | `[REDACTED_PRIVATE_KEY]` | FP near-zero. FN if header is corrupted/wrapped. **Never-allow: redact in all modes.** Run FIRST. |
| 2 | OpenAI-style key | `sk-(?:proj-)?[A-Za-z0-9_-]{20,}` | `[REDACTED_API_KEY]` | FP: any string literally starting `sk-`. Anchor on length ≥ 20. Also covers `sk-ant-` if you widen, but add an explicit `sk-ant-[A-Za-z0-9_-]{20,}` for Anthropic. |
| 3 | GitHub tokens | `gh[posru]_[A-Za-z0-9]{36,}` | `[REDACTED_API_KEY]` | Covers `ghp_/gho_/ghs_/ghu_/ghr_`. Fixed-ish length, low FP. Also `github_pat_[A-Za-z0-9_]{60,}` for fine-grained PATs. |
| 4 | AWS access key id | `AKIA[0-9A-Z]{16}` | `[REDACTED_AWS_KEY]` | Low FP (distinct prefix+charset). Also catch `ASIA` (temp). The **secret** access key has no prefix — rely on structured field match (`aws_secret_access_key`) + entropy, document this gap. |
| 5 | Google API key | `AIza[0-9A-Za-z_-]{35}` | `[REDACTED_API_KEY]` | Fixed length 39, low FP. |
| 6 | Slack token | `xox[baprs]-[0-9A-Za-z-]{10,}` | `[REDACTED_API_KEY]` | Distinct prefix, low FP. Add `xapp-` / `xoxe-` if needed. |
| 7 | Bearer / Authorization header | `(?i)(authorization|proxy-authorization)\s*[:=]\s*(bearer\s+)?\S+` → keep key name, redact value | `[REDACTED_AUTH]` | Prefer structured header match. Regex FP low (anchored on header name). Keep the word `Authorization:` so transcript stays readable. |
| 8 | Cookie / Set-Cookie | `(?i)(set-)?cookie\s*[:=]\s*[^\r\n]+` → redact value | `[REDACTED_COOKIE]` | Anchored on header name, low FP. Session cookies are the real prize here. |
| 9 | JWT | `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` | `[REDACTED_JWT]` | `eyJ` = base64 `{"`. Low FP. FN if not three-part (unsigned). Consider redacting 2-part too. |
| 10 | DB connection string | `(?i)(postgres(?:ql)?\|mysql\|mongodb(?:\+srv)?\|redis\|amqp\|mssql)://[^\s:@/]+:[^\s:@/]+@[^\s/]+` → redact the `:pass@` portion | `://[REDACTED_DB_CREDS]@host` (keep scheme+host) | Redact only the `user:pass`; keeping host/db aids debugging. FP low. Make password class `[^\s:@/]+` to stop at delimiters. |
| 11 | Git remote w/ creds | `https?://[^\s:@/]+:[^\s:@/]+@[^\s/]+` (generic userinfo) | `https://[REDACTED_CREDS]@host` | Catches `https://user:token@github.com/...`. Overlaps #10 — userinfo redactor should be one shared rule run before host-less URL handling. |
| 12 | `.env` KEY=VALUE secret | `(?im)^\s*(?:export\s+)?([A-Z][A-Z0-9_]*(?:KEY\|TOKEN\|SECRET\|PASSWORD\|PASSWD\|PWD\|CREDENTIAL\|AUTH\|PRIVATE\|SESSION)[A-Z0-9_]*)\s*=\s*['"]?([^'"\n]+)` → redact value | `KEY=[REDACTED_SECRET]` | Match on **key name semantics**, not value shape — this is the high-value rule for arbitrary secrets. FP: a var named `API_KEY=changeme` gets redacted (acceptable). FN: secret in a var named neutrally (e.g. `FOO=...`) — caught only by entropy/field layers. |
| 13 | password= field | `(?i)(password\|passwd\|pwd)\s*[:=]\s*['"]?[^'"\s,}]+` → redact value | `password=[REDACTED_SECRET]` | Broad, runs late. FP on docs/prose ("password: your password here"). Acceptable bias toward over-redaction. |
| 14 | Email address | `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` | `[REDACTED_EMAIL]` | FP: matches example.com, schema namespaces sometimes. Sanitized mode: redact. Private mode: keep (PII the user owns) — see §5. |
| 15 | Windows home | `(?i)C:\\Users\\[^\\\/:*?"<>|\r\n]+` → keep `C:\Users\`, redact the username segment | `C:\Users\[USER]` | Preserve the rest of the path (structure is useful), redact only the name. FP low. |
| 16 | POSIX home | `/(?:home\|Users)/[^/\s]+` → redact username segment | `/home/[USER]` or `/Users/[USER]` | Same approach. Don't redact `/usr`, `/home` alone. Anchor requires a following segment. |
| 17 | Other personal absolute path | context-dependent; redact the home-prefix only (covered by 15/16). Avoid blanket absolute-path redaction. | n/a | Blanket path redaction destroys readability and over-fires. Limit to home-dir-rooted paths. |
| 18 | IP address (v4) | `\b(?:(?:25[0-5]\|2[0-4]\d\|1?\d?\d)\.){3}(?:25[0-5]\|2[0-4]\d\|1?\d?\d)\b` | `[REDACTED_IP]` | **High FP** (version numbers, timestamps, coordinates). Default: redact only **public** IPs; leave RFC1918 (`10.`, `192.168.`, `172.16-31.`) and loopback alone, or make IP redaction opt-in. Document the noise. |
| 19 | IPv6 | standard IPv6 regex (long) | `[REDACTED_IP]` | Opt-in; very FP-prone. |
| 20 | User deny-list terms | literal, escaped, case-insensitive, whole-token | `[REDACTED_TERM]` | FP entirely user-controlled. |

Token-naming convention: one token per **semantic category**, not per pattern, so the report aggregates cleanly. Suggested set: `[REDACTED_PRIVATE_KEY]`, `[REDACTED_API_KEY]`, `[REDACTED_AWS_KEY]`, `[REDACTED_AUTH]`, `[REDACTED_COOKIE]`, `[REDACTED_JWT]`, `[REDACTED_DB_CREDS]`, `[REDACTED_CREDS]`, `[REDACTED_SECRET]`, `[REDACTED_EMAIL]`, `[REDACTED_IP]`, `[USER]`, `[REDACTED_TERM]`.

### 1.4 Where to apply

Redact over the **normalized** representation, after parsing, so structured fields are available, but apply text patterns to **every string-bearing field**: message text, tool-call inputs, tool results / command stdout+stderr, file-content blocks, thinking blocks, system prompts, titles, file paths, and any metadata strings. A secret pasted into a tool result is the most common real leak. Do **not** skip command output just because it's noisy.

---

## 2. Honesty rule (REDACTION_REPORT.md)

The report must let the user trust the bundle **without re-leaking** the secret it claims to have removed.

Hard rules:
- **Never print the original secret**, not even truncated/partial, not "first 4 chars", not a hash that could be brute-forced for short secrets. Print only **category + count + location**.
- **Location = file + event index (+ field), never value.** E.g. `normalized.jsonl event #42, field tool_result`. The user can open that event in the *redacted* output to see context (which now shows `[REDACTED_API_KEY]`), never the original.
- **Count by category**, with a total. This is the auditable contract: "12 secrets removed across 5 categories."
- The report itself is a bundle artifact and **must also pass redaction** — it cannot contain a value, so by construction it has nothing to leak, but the test suite must assert this (§6).
- If the entropy layer *flagged but did not redact* something, list it as "N high-entropy strings flagged for manual review at <locations>" — again location only.

Suggested report shape:

```
# Redaction Report
Mode: sanitized
Generated: 2026-06-20T...Z
Total redactions: 12

## By category
| Category            | Count |
|---------------------|-------|
| API key             | 4     |
| Auth header         | 2     |
| Private key         | 1     |
| DB credentials      | 1     |
| Email               | 3     |
| Home directory      | 1     |

## Locations (no values)
- [API key] normalized.jsonl event #42 (tool_result)
- [Private key] normalized.jsonl event #7 (file_content: key.pem)
- ...

## Flagged for review (not auto-redacted)
- [high-entropy] event #19 (tool_result) — verify manually
```

Honesty also means **not over-claiming**: if `--no-redaction` was used, the report must say so loudly and state that the bundle is raw. The report should never imply "clean" when it isn't.

---

## 3. Bundle / filesystem threats

The bundle name and any path inside it can be **session-derived = attacker-influenced**. Defenses:

1. **Path traversal in bundle name.** Derive the bundle/dir name, then **sanitize hard**: allow `[A-Za-z0-9._-]` only; strip/replace everything else; reject or collapse `..`; strip leading dots, drive letters, slashes, and backslashes; cap length; reject reserved Windows names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and trailing dots/spaces. After building the final absolute path, **re-canonicalize and assert it is still inside** `.../.sessionporter/exports/` (prefix check on the *realpath*, using `os.path.realpath` / `Path.resolve()`, with a separator-aware containment check so `exports-evil` doesn't pass as under `exports`). If it escapes, abort.
2. **Zip slip (ZIP-entry traversal).** When building `bundle.zip`, add entries with **controlled, relative arcnames only** (you generated them — never echo a log-derived path into an arcname). When *reading* any zip (if a re-import/verify path exists), for each entry compute `realpath(join(dest, entry))` and assert it stays under `dest`; reject absolute entries, `..` segments, and entries with drive letters. Never trust `ZipFile.extractall` blindly. Reject entries that are symlinks (zip can carry symlink entries via Unix mode bits).
3. **Symlink following.** Before writing the export dir, if it exists and is a symlink, refuse (don't write through it to an arbitrary target). When creating the dir tree, create components yourself and verify none is a symlink to outside. On read of source `.jsonl`, resolve and confirm you're reading a regular file. Where the OS supports it, open with `O_NOFOLLOW` semantics for the final component; on Windows, check `reparse point` / use `Path.is_symlink()` before write. Never `rmtree` a path you haven't confirmed is non-symlink and inside the sandbox.
4. **Overwriting an existing export.** Default to **refuse-and-name-uniquely**: if `<bundle>/` exists, either error with a clear message or append a timestamp/`-2` suffix. Only overwrite under an explicit `--force`, and even then never `rmtree` outside the verified sandbox path. Never silently clobber.
5. **Exporting into a git-tracked or public directory.** Before writing, walk up from the chosen export root: if a `.git` is found above the export dir (i.e. the export would land inside a repo), **warn and require confirmation / `--allow-git-dir`**. Strongly recommend the default export root be the user's data dir, not CWD. Also detect and warn if the path looks publish-adjacent (e.g. under a `docs/`, `public/`, `gh-pages`, or a directory containing a Pages/Netlify/Vercel config). At minimum: write a `.gitignore` containing `*` into the export dir so an accidental `git add .` in a parent won't stage the bundle.
6. **Filename sanitization (all written files).** Every artifact filename is fixed/known (`normalized.jsonl`, etc.) — never derive a written filename from log content. If per-event attachments are ever written, sanitize as in (1).
7. **Restrictive file permissions.** Create the export dir `0700` and files `0600` on POSIX (umask-independent: set mode explicitly with `os.open`/`os.chmod`). On Windows, set an ACL granting only the current user (or document that NTFS inheritance applies and the parent is user-private). The bundle contains residual-risk data; don't make it world-readable.
8. **Atomic writes.** Write each artifact to a temp file in the **same dir** (`<name>.tmp-<pid>`) then `os.replace()` (atomic on same filesystem) to the final name. Prevents half-written, partially-redacted files if the process dies mid-write. Build the whole bundle in a temp dir (`exports/.<bundle>.partial/`) and atomically rename to `<bundle>/` only after success + verification, so a crash never leaves a half-redacted "looks done" bundle.
9. **Checksums file correctness.** `checksums.sha256` must list every other artifact and **must not list itself** (you can't checksum a file whose content depends on the checksum). Generate all artifacts → compute hashes → write checksums **last**. Verify on read by recomputing. Use a stable relative-path format and sort entries deterministically. If `bundle.zip` includes the loose files, decide one source of truth (recommend: checksums cover the loose files; the zip is a convenience copy and is itself listed by a separate top-level hash or excluded).

---

## 4. No-replay / no-egress

The tool is a **pure local transform**. It must never act on session content.

Rules:
- **Never execute or eval** any command, code, or script found in the session. No `os.system`, `subprocess` with log-derived args, `eval`, `exec`, deserialization of pickles, or shelling out to "reproduce" anything. Parsing is read-only.
- **Never render as HTML / never open in a browser.** `transcript.md` and `summary.md` are Markdown text files written to disk; the tool does not render them. When emitting Markdown, **neutralize injection**: escape or fence raw HTML, defang URLs in untrusted text if you want extra safety (e.g. don't auto-link), and never embed remote images (`![](http://attacker/...)`) that a Markdown viewer would fetch — strip/`defang` image URLs from untrusted content or convert to inert text.
- **Never fetch URLs.** No network calls of any kind for content. URLs in logs are data, not actions.
- **Never open files a log names.** A tool-result that says "see /etc/passwd" or `C:\Users\me\.ssh\id_rsa` must not cause SessionPorter to read that file. The only files it reads are the session `.jsonl`(s) the user explicitly pointed it at.
- **No network / analytics / telemetry, period.** No update checks, no crash reporting, no usage pings.

Proving no egress (test, see §6): run the full export inside a harness that **traps/monkeypatches the network primitives** and fails if any is called — `socket.socket`, `http.client`, `urllib.request.urlopen`, `ssl`, DNS (`socket.getaddrinfo`), and (if Node) `fetch`/`http`/`https`/`net`/`dns`. Replace each with a stub that raises `EgressAttemptError`. Run a representative export (including a log seeded with URLs, image links, and a `fetch(...)` string) and assert zero calls. Optionally also assert no subprocess spawns (`subprocess.Popen` trap) to prove no-replay in the same harness. CI-grade version: run with no network namespace / offline and assert success (tool must work fully offline).

---

## 5. Private-mode safeguards

`private` mode retains more (keeps emails, home dirs, IPs, internal hostnames — PII the user owns and may want for their own archive) but is **not** "off."

Must still be blocked in private mode (the **never-allow list**, fires in every mode):
- **PEM private-key blocks** (#1). Reason: a private key in a "private" bundle is still catastrophic if the bundle ever leaves the machine; there is no legitimate reason to ship one in a portability bundle, and users routinely paste keys into logs by accident.
- **Obvious live credentials with unambiguous vendor prefixes**: `AKIA…`, `ghp_/gho_/ghs_…`, `sk-…`, `AIza…`, `xox*…`, JWTs, and `Authorization: Bearer …`. Reason: these are unambiguously secrets, never benign content, and keeping them provides no archival value while creating a live-credential leak path. FP risk is low enough that always-redacting them is safe even in private mode.
- **DB connection-string passwords and git-remote embedded creds** (the `user:pass@` userinfo). Same reasoning.

Difference vs sanitized: private mode **keeps** emails, home-dir usernames, public/private IPs, generic `.env` values that aren't obviously credentials, and user deny-list terms (optional). It's "remove live secrets, keep my personal context."

`--no-redaction` must be **hard to reach**:
- Not a short flag, no env-var-only toggle; require the long `--no-redaction` **plus** an explicit interactive confirmation (typed `yes`) **plus** a one-line acknowledgement in the report and a warning banner on stdout.
- Even `--no-redaction` should arguably **keep the never-allow private-key rule** (defensible default: "we will never write a private key into a bundle, full stop"). At minimum, if it truly disables everything, the tool must print a red, unmissable warning and stamp `RAW — UNREDACTED` into the manifest, report, and a `RAW` marker filename so the user cannot forget what this bundle is. Document that `--no-redaction` bundles must never be shared.
- Never make `--no-redaction` the default of any other flag, alias, or config preset. It should require deliberate, logged intent each run.

---

## 6. Concrete security test list

Each test states input shape → expected behavior. These are the acceptance gate.

**Redaction (positive — must redact):**
1. `.jsonl` with a tool_result containing `sk-proj-<40 chars>` → `normalized.jsonl` and `transcript.md` contain `[REDACTED_API_KEY]`, zero occurrences of the original; report counts API key = 1 with location.
2. One event per vendor prefix (`ghp_`, `AKIA…`, `AIza…`, `xox b/a/p/r/s`, JWT, `sk-ant-`) → each redacted to its category token; report category counts correct.
3. A PEM `-----BEGIN OPENSSH PRIVATE KEY-----…END-----` spanning many lines → whole block becomes `[REDACTED_PRIVATE_KEY]`, no inner base64 line leaks, block boundaries gone.
4. `Authorization: Bearer abc.def.ghi`, a `Cookie: session=…` header, a `postgres://u:p@h/db`, a `https://user:tok@github.com/x.git` → each value redacted, surrounding key/scheme/host preserved.
5. `.env` block with `OPENAI_API_KEY=...`, `DB_PASSWORD=...`, `NEUTRAL=plainvalue` → first two redacted (key-name semantics), `NEUTRAL` kept (unless entropy on).
6. Home dirs `C:\Users\<user>\project` and `/home/<user>/x` and `/Users/<user>/y` → username segment redacted, rest of path intact.

**Redaction (negative — must NOT redact / no corruption):**
7. Text containing `[REDACTED_API_KEY]` literally, plus a git SHA, a UUID, `192.168.1.1`, `version 1.2.3.4` → tokens not re-matched, SHA/UUID/private-IP/version not redacted (with default IP policy); assert idempotency: redacting twice == redacting once.
8. Overlapping case: a PEM block that itself contains a line resembling `password=...` → block redaction wins, output is a single `[REDACTED_PRIVATE_KEY]`, not a mangled mix.

**Honesty:**
9. After any redaction run, grep the **entire bundle** (all files incl. `REDACTION_REPORT.md`, `summary.md`, `manifest.json`) for each original secret string → **zero matches anywhere**. Report contains only categories, counts, and `file + event#` locations, never a value or partial value.

**Path traversal / bundle name:**
10. Session metadata that yields a title like `../../evil` or `C:\Windows\System32\x` or `con` → sanitized name stays inside `exports/`; realpath containment assertion passes; reserved name rejected.

**Zip slip:**
11. Build `bundle.zip`, inspect arcnames → all relative, no `..`, no absolute, no drive letters, no symlink entries. (If a read/verify path exists) feed a hand-crafted zip with a `../../x` entry → extraction refuses and errors.

**Symlink:**
12. Pre-create `exports/<bundle>` as a symlink to a temp dir outside the sandbox → tool refuses to write through it. Source `.jsonl` is a symlink to `/etc/passwd`-like target → tool refuses or only reads the explicitly-named regular file, never the symlink target outside.

**Overwrite:**
13. Run export twice with same name → second run does not silently clobber; it errors or creates a unique name; `--force` overwrites only the verified in-sandbox dir and never touches anything outside.

**Git-tracked destination:**
14. Run with export root inside a dir that has a `.git` above it → tool warns and requires `--allow-git-dir`; export dir gets a `.gitignore` `*`; without the flag it refuses.

**Checksum tampering:**
15. Generate bundle, flip one byte in `normalized.jsonl`, run verify → checksum mismatch detected and reported. Assert `checksums.sha256` does not list itself and lists every other artifact.

**Private-raw-absent-in-sanitized / mode boundary:**
16. Same input through sanitized vs private: private keeps emails/home-dirs/IPs; sanitized redacts them. **Both** redact private keys and vendor-prefixed live keys (never-allow). Diff the two bundles to prove the only differences are the PII categories, and that no never-allow secret survives in either.
17. `--no-redaction` requires the long flag + typed confirmation; resulting bundle is stamped `RAW`/`UNREDACTED` in manifest+report+marker; private-key never-allow still applied (per chosen default). Assert it is not reachable via any alias/short-flag/env-only path.

**No-egress / no-replay:**
18. Run a full export under a network-trap harness (stub `socket`, `http.client`, `urllib`, `getaddrinfo`, `ssl`; Node: `fetch/http/https/net/dns`) on a log seeded with URLs, a remote image link, and a literal `fetch('http://evil')` string → zero network calls; export succeeds offline. Same harness traps `subprocess`/`os.system` → zero process spawns (no-replay). Assert `transcript.md` did not auto-link or embed the remote image (no fetchable `![]()` with a remote URL from untrusted content).

---

## 7. Recommendations summary (for the implementer)

- Implement redaction as **collect-spans-then-single-splice**, not chained `re.sub`, ordered private-key → structured-creds → vendor-prefix → generic/env → PII. Highest priority span wins overlaps. Guard against re-matching `[REDACTED_*]`.
- Make the **structured field-name layer** first-class — it catches shapeless secrets regex can't.
- Build the bundle in a `.partial` temp dir, verify, then **atomic rename**; write checksums last; `.gitignore *` in every export dir; `0700/0600` perms.
- Treat the **bundle name and every zip arcname as hostile**; realpath-contain everything; never extract untrusted zips blindly.
- **Never-allow list** (private keys + unambiguous live keys) fires in *every* mode; `--no-redaction` needs a long flag + typed confirmation + RAW stamping and still should block private keys by default.
- Ship the **network-trap + subprocess-trap test** as a permanent CI gate — it's the cheapest proof of "local-first, no egress, no replay."

— redaction-security-reviewer (subagent), 2026-06-20
