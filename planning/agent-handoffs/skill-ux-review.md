# Handoff: `/export-session` skill UX review

Date: 2026-06-20
From: skill-ux-reviewer (subagent)
Scope: ANALYSIS ONLY. This note designs the `/export-session` Claude Code skill that
drives the `sessionporter` CLI. No code was written. It also specifies the CLI surface
the skill depends on, so the core CLI team can implement it to match.

---

## 0. Repo state at time of review

`sessionporter` is early scaffolding: only `package.json` + `tsconfig.json` exist;
`src/{cli,core,discovery,redact,bundle,validate,normalize,adapters,security,types}` and
`fixtures/{claude,codex,manual}` are empty dirs. `planning/agent-handoffs/` was empty
(this is the first handoff). `skills/claude-code/` is the intended in-repo home for the
skill source. Package facts that constrain the design:

- name `sessionporter`, bin `sessionporter` -> `dist/cli/index.js`, Node >= 20, ESM.
- Self-description: "Export one AI coding session into a portable, reviewable,
  privacy-aware bundle. Local-first, no network, no runtime dependencies."

Everything below is therefore a contract to build against, not a description of code
that exists. Where I assert a CLI flag, treat it as a requirement on the core CLI, not
an observed fact.

---

## 1. SKILL.md frontmatter + structure (matches local conventions)

### Where it installs

- Canonical install path: `~/.claude/skills/export-session/SKILL.md`
  (on this machine `C:\Users\isaac\.claude\skills\export-session\SKILL.md`).
- Keep the authored source in-repo at `skills/claude-code/export-session/SKILL.md` and
  install it with the existing `install-skill` skill (dry-run, skim, then real install),
  not by hand-copying. Per the local `install-skill` convention: after install, tell
  Isaac to restart the session and note each loaded skill costs a little context.
- Installation is itself a gated action. Document the install command in the repo
  README; do NOT install globally as part of an automated build without Isaac's explicit
  yes. The skill ships in the repo; promotion to `~/.claude/skills` is a separate,
  approved step.

### Frontmatter conventions observed locally

From `skill-scout`, `install-skill`, `export-claude-code-chats`, `caveman`, `find-skills`:

- `name:` kebab-case, must equal the folder name (`export-session`).
- `description:` folded scalar (`>-`), THIRD PERSON, and packed with literal trigger
  phrases in quotes ("export this session", "send to AgentTrace", etc.). This is what the
  model matches on, so it must enumerate the user phrasings.
- `allowed-tools:` is used by risky skills (skill-scout scopes `Bash(...)` narrowly).
  Use it here to pre-approve only the read-mostly CLI calls and keep the destructive
  export call OUT of the allowlist so it always trips a permission prompt.
- Optional `metadata:\n  tags: [...]` (export-claude-code-chats uses
  `[claude-memory, tooling]`).
- NOTE: local skills do NOT use an `argument-hint` field. Argument forms are documented
  in the body in a table. Follow that convention; do not invent frontmatter fields.

### Exact frontmatter to use

```yaml
---
name: export-session
description: >-
  Export one Claude Code session into a portable, reviewable, privacy-aware
  bundle using the local `sessionporter` CLI. Defaults to a SANITIZED export and
  requires an explicit confirmation for a full-fidelity PRIVATE export. Use when
  Isaac says "export this session", "export my Claude Code session", "package this
  session for AgentTrace", "send this chat to AgentTrace", "make a portable bundle
  of this session", "redact and export this session", "export session sanitized",
  or "import a session bundle". Shows a redaction preview before writing and
  returns the local file paths (the AgentTrace JSONL, the offline-Claude
  transcript, the zip, and the redaction report). Local-first, no network.
allowed-tools: >-
  Bash(sessionporter discover *), Bash(sessionporter inspect *),
  Bash(sessionporter redact-preview *), Bash(sessionporter validate *),
  Bash(sessionporter import *)
metadata:
  tags: [claude-memory, tooling, privacy]
---
```

Why `export` is excluded from `allowed-tools`: discover / inspect / redact-preview /
validate / import are read-mostly and safe to pre-approve so the flow is quiet. The
actual `sessionporter export ...` write is deliberately NOT pre-approved, so every real
export (sanitized OR private) surfaces a permission prompt. This is the harness-level
backstop behind the in-skill private-mode gate.

### Body structure (mirror skill-scout's shape)

1. H1 title + one-line purpose.
2. A HARD SAFETY INVARIANTS ASCII box (skill-scout style) with the non-waivable rules:
   default sanitized; never silent sanitized->private fallback; private needs explicit
   deliberate confirmation; never guess the current session; never duplicate export
   logic (always shell out to the CLI); never upload the private bundle publicly.
3. "What it does" (3-5 bullets).
4. "When to use" + the argument-forms table.
5. "Decision tree" (section 2 below), as a numbered/checklist flow.
6. "CLI commands per branch" (section 3) in fenced PowerShell blocks.
7. "Success message format" + "Failure states" (section 4).
8. "Anti-patterns" (section 5).
9. Closing reminder block (review the redaction report; private bundle is not for public
   upload; transcripts may contain proprietary code or personal info).

### Argument forms (document in the body table)

| Invocation | Meaning |
|---|---|
| `/export-session` | auto-detect current session; if ambiguous, list + pick one; default sanitized |
| `/export-session current` | force current-session detection; default sanitized |
| `/export-session choose` | skip auto-detect, always show the numbered candidate list |
| `/export-session current sanitized` | current session, explicit sanitized |
| `/export-session <session-id> sanitized` | named session, explicit sanitized |
| `/export-session <session-id> private` | named session, PRIVATE (still hits the confirm gate) |
| `/export-session import <file>` | import/validate an existing bundle (round-trip check) |

Mode token is the last positional arg and is one of `sanitized` | `private`. Absent =>
`sanitized`. `private` anywhere in the args still routes through the confirmation gate;
it never makes the export private without the explicit yes.

---

## 2. Minimal decision tree (fewest prompts)

Design target: the happy path is ZERO prompts (auto-detect + sanitized default +
harness permission prompt on the write). Extra prompts appear ONLY for genuine ambiguity
(which session) or genuine risk (private mode). Never prompt for mode when the user
already supplied it.

```
START /export-session [arg1] [arg2]
│
├─ import form?  (arg1 == "import")
│     └─ run `sessionporter import <file> --json` -> VALIDATE branch -> report -> END
│
├─ Resolve SESSION (no prompt if avoidable)
│   ├─ arg1 is a session-id?            -> use it.
│   ├─ arg1 == "choose"?                -> force the list (skip auto-detect).
│   ├─ else (default / "current"):
│   │     run `sessionporter discover --current --json`
│   │     ├─ exactly 1 confident match  -> use it. NO PROMPT.
│   │     ├─ 0 matches                  -> FAILURE: no sessions (see 4). END.
│   │     └─ >1 / low confidence (AMBIGUOUS-CURRENT):
│   │           run `sessionporter discover --json` (full candidate list)
│   │           -> show NUMBERED list (id, project/cwd, started, turns, size)
│   │           -> PROMPT ONCE: "pick exactly one [1-N]"
│   │           -> map choice to session-id. (Never auto-pick. Never guess.)
│
├─ Resolve MODE
│   ├─ arg has "sanitized"  -> mode = sanitized. NO PROMPT.
│   ├─ arg has "private"    -> go to PRIVATE GATE.
│   └─ absent               -> mode = sanitized (the default). NO PROMPT.
│
├─ PREVIEW (always, single screen, no prompt yet)
│     run `sessionporter inspect <id> --json`         (metadata)
│     run `sessionporter redact-preview <id> --json`  (redaction counts)
│     show: session meta + "would redact: N emails, M local paths, K possible tokens,
│           ..." + the chosen mode + the 4 output paths that WILL be written.
│
├─ PRIVATE GATE  (only if mode == private)
│     Show explicit warning: private = FULL fidelity, NO redaction; may contain
│     secrets / proprietary code / personal info; not for public upload.
│     PROMPT for a deliberate confirmation: require typing  CONFIRM PRIVATE
│     (a bare "y" is NOT accepted — deliberate token only).
│     ├─ confirmed     -> mode stays private.
│     └─ not confirmed -> DO NOT fall back to sanitized silently. Abort with a
│                         message offering to re-run sanitized. END.
│
├─ EXPORT  (this is the one write; NOT in allowed-tools, so harness prompts too)
│     sanitized: `sessionporter export <id> --mode sanitized --json`
│     private:   `sessionporter export <id> --mode private --confirm-private --json`
│     ├─ output path exists & no --force -> FAILURE: output exists (see 4). END.
│     └─ ok -> capture JSON paths.
│
├─ VALIDATE (cheap integrity gate before declaring success)
│     run `sessionporter validate <bundle-zip> --json`
│     ├─ ok      -> SUCCESS message (see 4). END.
│     └─ failed  -> FAILURE: validation failed (see 4). END.
│
END
```

Prompt budget: happy path = 0 in-skill prompts. Ambiguous current = 1 (pick session).
Private = 1 (the confirm token). Both at once = 2. Nothing else ever prompts.

---

## 3. CLI commands per branch + parsing (recommend `--json`)

The skill must NOT re-implement discovery, redaction, normalization, bundling, or
validation. It only orchestrates the CLI and formats output. To make CLI output safe to
parse, the CLI should offer a machine mode: **every subcommand takes `--json` and prints
a single JSON object to stdout, human text to stderr, and uses exit codes for control
flow.** The skill always passes `--json` and parses stdout; it never screen-scrapes
human text.

### Recommended `--json` CLI contract (requirement on core CLI)

Common envelope on every command:

```json
{ "ok": true, "command": "discover", "version": "0.1.0", "data": { ... } }
```

On failure:

```json
{ "ok": false, "command": "export", "error": { "code": "OUTPUT_EXISTS", "message": "..." } }
```

Exit codes: `0` ok; `2` user-correctable (no sessions, ambiguous, output exists,
validation failed); `1` unexpected. The skill branches on `error.code`, not on message
text.

| Branch | Command (skill always appends `--json`) | Parses |
|---|---|---|
| discover current | `sessionporter discover --current --json` | `data.matches[]` (each: `id`, `cwd`, `project`, `startedAt`, `turns`, `bytes`, `confidence`) and `data.confident` (bool) |
| discover all | `sessionporter discover --json` | same `data.matches[]`, for the numbered picker |
| inspect | `sessionporter inspect <id> --json` | `data.meta` (`id`, `project`, `cwd`, `startedAt`, `endedAt`, `turns`, `model`, `bytes`) |
| redact preview | `sessionporter redact-preview <id> --json` | `data.counts` (`emails`, `localPaths`, `possibleTokens`, `secrets`, `urls`, ...) + `data.total` |
| export sanitized | `sessionporter export <id> --mode sanitized --json` | `data.outputs` (see below) |
| export private | `sessionporter export <id> --mode private --confirm-private --json` | `data.outputs` |
| validate | `sessionporter validate <bundle-or-dir> --json` | `data.valid` (bool), `data.checks[]` |
| import | `sessionporter import <file> --json` | `data.valid`, `data.outDir`, `data.checks[]` |

Required `data.outputs` shape from `export` (so the success message is built mechanically,
no path guessing):

```json
{
  "outputs": {
    "normalizedJsonl": "C:\\...\\<session>\\session.normalized.jsonl",
    "transcriptMd":    "C:\\...\\<session>\\session.transcript.md",
    "bundleZip":       "C:\\...\\<session>\\<session>.bundle.zip",
    "redactionReport": "C:\\...\\<session>\\REDACTION_REPORT.md",
    "mode": "sanitized"
  }
}
```

Notes for the CLI team:
- `--confirm-private` is a REQUIRED flag for `--mode private`. Without it the CLI must
  refuse (exit 2, `error.code = PRIVATE_NOT_CONFIRMED`). This is defense in depth: even if
  a future caller forgets the skill-side gate, the CLI will not silently produce a private
  bundle. And the CLI must NEVER auto-downgrade private->sanitized; it errors instead.
- `export` must support `--force` (overwrite) and, without it, exit 2 with
  `error.code = OUTPUT_EXISTS` plus the offending path in `error.message`. The skill
  surfaces that as the friendly "output exists" failure and offers `--force`.
- `--out <dir>` lets the skill control destination; default to a per-session folder under
  the repo/CWD. Keep paths absolute in `outputs` so the skill can echo them verbatim.
- Discovery "current session": the CLI should resolve via the running session's own
  JSONL (e.g. the active `~/.claude/projects/<slug>/*.jsonl` for this cwd, newest open
  handle / `$CLAUDE_SESSION_ID` if exposed), and set `confident=false` when more than one
  plausibly-active file matches. The skill must treat `confident=false` as ambiguous and
  show the picker. The skill MUST NOT itself guess by mtime; that logic lives in the CLI.

---

## 4. Success + failure message formats

### Success (sanitized)

```
Exported session  <id>  (sanitized)  —  <turns> turns, <project>

  Review first:
    REDACTION_REPORT   C:\...\<session>\REDACTION_REPORT.md
    (redacted: 2 emails, 4 local paths, 1 possible token)

  Files:
    -> AgentTrace        session.normalized.jsonl   C:\...\<session>\session.normalized.jsonl
    -> Offline Claude    session.transcript.md      C:\...\<session>\session.transcript.md
    Bundle (zip)         <session>.bundle.zip       C:\...\<session>\<session>.bundle.zip

  Validation: PASSED.

  Reminders:
    - Open the REDACTION_REPORT and confirm nothing sensitive slipped through.
    - Sanitized bundle is review-safe. Do not upload a PRIVATE bundle publicly.
    - Transcripts can still contain proprietary code or personal info — check before sharing.
```

(Use plain prose, not em-dashes as connectors, per Isaac's writing rule; the single
"—" above are decorative/aligned separators, replace with commas if read as punctuation.)

Mapping the four artifacts explicitly, because the task requires it:
- `session.normalized.jsonl` -> goes to **AgentTrace** (the normalized JSONL importer).
- `session.transcript.md` -> goes to an **offline Claude conversation** (human-readable).
- `<session>.bundle.zip` -> the portable bundle containing both + the report.
- `REDACTION_REPORT.md` -> the review artifact; surface it FIRST, before the file list.

### Success (private)

Same layout, but header reads `(PRIVATE — full fidelity, NOT redacted)` and the reminder
block leads with: "This bundle is unredacted. Keep it local. Never attach it to a public
issue, PR, gist, or AgentTrace upload that others can see."

### Failure states (friendly, actionable, one screen each)

| State | Trigger | Message (gist) |
|---|---|---|
| No sessions | `discover` -> 0 matches | "No Claude Code sessions found for this folder. Run `/export-session choose` to list all sessions on this machine, or check that `~/.claude/projects` has history." |
| Ambiguous current | `discover --current` -> `confident=false` / >1 | NOT an error: show the numbered picker and ask for one pick. Only becomes an error if the user declines to pick. |
| Malformed session | `inspect`/`export` -> `error.code=MALFORMED_SESSION` | "That session file looks corrupted or truncated (couldn't parse turn N). Pick a different session, or try `--mode private` to bundle raw bytes for manual recovery." Do not crash the skill on a parse error. |
| Output exists | `export` -> exit 2 `OUTPUT_EXISTS` | "A bundle already exists at <path>. Re-run with `--force` to overwrite, or choose a new `--out` folder. I won't overwrite without your say-so." |
| Validation failed | `validate` -> `valid=false` | "Export wrote files but the bundle failed its integrity check (<failed check>). Treat the bundle as untrusted — don't ship it. Re-run the export, and if it persists this is a CLI bug to file." |
| Private not confirmed | gate declined OR CLI `PRIVATE_NOT_CONFIRMED` | "Private export cancelled. I did NOT fall back to sanitized. Re-run and type `CONFIRM PRIVATE` to proceed, or run `/export-session <id> sanitized` for the safe export." |

---

## 5. Anti-patterns to avoid

- **Too many prompts.** Do not ask "which session?" when discovery is confident, and do
  not ask "which mode?" when the user already said sanitized/private or when defaulting to
  sanitized. Happy path is zero in-skill prompts.
- **Hidden / silent private mode.** Never produce a full-fidelity bundle without the
  explicit `CONFIRM PRIVATE` token. Never auto-upgrade to private, and never auto-downgrade
  private->sanitized on a declined confirmation. Cancel instead of guessing.
- **Duplicated export logic.** The skill must never read JSONL, run regex redaction, build
  the zip, or write the transcript itself. All of that lives in the CLI. The skill only
  resolves args, previews, gates, shells out, and formats. If a needed capability is
  missing, the fix is a CLI flag, not skill-side logic.
- **Guessing the current session.** No mtime/"newest file wins" heuristics inside the
  skill. Delegate "which session is current" to `sessionporter discover --current`; if it
  reports low confidence, show the picker. A wrong guess can export the wrong project's
  proprietary code.
- **Screen-scraping human output.** Always pass `--json` and parse the envelope + exit
  code. Never branch on human-readable text (it will change and break the skill).
- **Burying the redaction report.** Surface `REDACTION_REPORT.md` and the redaction counts
  BEFORE the file list, every time. The review step is the whole point of "privacy-aware".
- **Treating sanitized as automatically safe-to-publish.** Even sanitized transcripts can
  carry proprietary code or personal context. Keep the "check before sharing" reminder.

---

## 6. Open items for the CLI team (so the skill can be built as specced)

1. Implement `--json` envelope + stable `error.code`s + exit-code convention on
   `discover`, `inspect`, `redact-preview`, `export`, `validate`, `import`.
2. `discover --current` must return a `confident` boolean and resolve the active session
   without the skill guessing.
3. `export --mode private` must require `--confirm-private`; refuse otherwise; never
   auto-downgrade.
4. `export` must emit absolute `outputs` paths for all four artifacts and support
   `--force` / `--out`.
5. `validate` must run as the post-export integrity gate and as the `import` round-trip.

Once those land, the skill in `skills/claude-code/export-session/` can be finalized and
(with Isaac's approval) installed to `~/.claude/skills/export-session/` via `install-skill`.

— skill-ux-reviewer (subagent)
