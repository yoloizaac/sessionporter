# Final demo shot list

Video: `demo/final-demo-captioned.mp4` (1280x720, h264, 3:57.68).
Source: an automated terminal **replay** of real, verified SessionPorter output
(`demo/final-replay/`), recorded with Playwright. The top-right badge reads
"Automated replay of verified SessionPorter CLI output" on every frame, so the
footage is never presented as a live shell.

All command output is taken verbatim from `demo/demo-capture.txt`, which is the
sanitized capture of SessionPorter running against the bundled **synthetic**
fixture. No real session, no personal path, and no secret value appears.

Field key: Screen = what surface is shown; Cursor/action = on-screen motion;
Zoom/highlight = emphasis; Privacy = the per-scene check that passed; Criterion =
the assessment point the scene carries.

---

### Scene 1 — Title (00:00.4 – 00:15.9)
- Screen / app: full-screen title card (replay player)
- File / command: none (brand + one-line value)
- Cursor / action: static; checklist of four properties is on screen
- Zoom / highlight: product name at 72px; repo URL at the foot
- Narration: "SessionPorter converts one selected AI coding session into a portable, validated, privacy-aware bundle."
- Caption: same as narration
- Transition: hard cut into the workflow card
- Privacy check: no path, no email, no secret; replay badge present
- Criterion: what the project does

### Scene 2 — Workflow (00:15.9 – 00:33.1)
- Screen / app: pipeline diagram + output file list
- File / command: none (conceptual map)
- Cursor / action: static pipeline; six output filenames listed
- Zoom / highlight: the Discover → Validate → Upload safely pipeline
- Narration: "Logs are useful evidence but contain credentials, private paths, and tool-specific formats. SessionPorter discovers one session, redacts, validates, and exports."
- Caption: same as narration
- Transition: hard cut
- Privacy check: filenames only, no contents
- Criterion: problem framing + what the project does

### Scene 3 — Architecture (00:33.1 – 00:50.3)
- Screen / app: repository tree
- File / command: `src/adapters`, `src/normalize`, `src/redact`, `src/bundle`, `src/validate`, `skills/…`, `tests/`, `planning/`
- Cursor / action: static annotated tree
- Zoom / highlight: redaction labelled "security boundary"; adapters labelled "source-specific"
- Narration: "Source-specific adapters are separate from normalization, redaction, bundle creation, and validation. The Claude Code skill is a thin wrapper around the same core."
- Caption: same as narration
- Transition: hard cut into first terminal scene
- Privacy check: directory names only
- Criterion: simple, maintainable structure

### Scene 4 — Discover (00:50.3 – 01:07.5)
- Screen / app: terminal replay
- File / command: `sessionporter discover --source claude`
- Cursor / action: prompt then rendered metadata list; blinking caret at end
- Zoom / highlight: the second, ambiguous "(untitled)" entry with 0 events
- Narration: "Discovery is read-only and returns metadata first. SessionPorter never exports everything, and refuses to guess when the current session is ambiguous."
- Caption: same as narration
- Transition: hard cut
- Privacy check: synthetic session ids only; prompt shows `PS sessionporter>` not a home path
- Criterion: secure-by-default behavior; a feature

### Scene 5 — Inspect + redact-preview (01:07.5 – 01:28.1)
- Screen / app: terminal replay
- File / command: `sessionporter inspect …` then `sessionporter redact-preview …`
- Cursor / action: two commands run in sequence; caret at end
- Zoom / highlight: the category:count line and "(original secret values are never shown)"
- Narration: "Inspect one selected session, then preview likely redactions. The report shows categories and counts, never the original secret."
- Caption: same as narration
- Transition: hard cut
- Privacy check: counts only; no value is ever printed
- Criterion: security; a feature

### Scene 6 — Export (01:28.1 – 01:45.3)
- Screen / app: terminal replay
- File / command: `sessionporter export --source claude --session … --mode sanitized`
- Cursor / action: command, "Export complete.", three next-step paths
- Zoom / highlight: the three review/upload destinations under `.sessionporter\exports\…`
- Narration: "Sanitized mode is the default. Private mode keeps more content and requires explicit confirmation; it never falls back silently."
- Caption: same as narration
- Transition: hard cut
- Privacy check: export paths shown as `.sessionporter\exports\…`, no absolute home path
- Criterion: secure default; sensible trade-off

### Scene 7 — The bundle (01:45.3 – 02:07.7)
- Screen / app: terminal replay (bundle contents + excerpts)
- File / command: bundle file list + headers of transcript / redaction report / manifest
- Cursor / action: file list then three short excerpts
- Zoom / highlight: "Hidden model reasoning is NOT reconstructed" honesty line
- Narration: "The transcript preserves chronological evidence. The redaction report explains changes, the manifest records mode and counts, and checksums make tampering detectable."
- Caption: same as narration
- Transition: hard cut
- Privacy check: excerpts are from the synthetic bundle; markers are `[REDACTED_*]`
- Criterion: features added; honest completeness

### Scene 8 — Validate + tests (02:07.7 – 02:26.6)
- Screen / app: terminal replay
- File / command: `sessionporter validate <bundle>`, `npm test`, `npm run test:security`
- Cursor / action: three commands, green pass lines
- Zoom / highlight: "63 passed", "26 passed", "typecheck/lint/build" line
- Narration: "The validator checks required files and SHA-256 checksums. Tests cover parsing, normalization, redaction, archive safety, path traversal, symlinks, and network isolation."
- Caption: same as narration
- Transition: hard cut
- Privacy check: counts only
- Criterion: testing and review; security

### Scene 9 — Agents and handoffs (02:26.6 – 02:49.8)
- Screen / app: annotated handoff tree
- File / command: `planning/agent-handoffs/*.md`, `planning/09`, `planning/10`
- Cursor / action: static tree of five handoffs + their focus
- Zoom / highlight: portability-review labelled "read AgentTrace's real parser"
- Narration: "Claude Code was the primary agent. Focused subagents independently reviewed formats, redaction, portability, skill UX, and final security. The main agent integrated their handoffs."
- Caption: same as narration
- Transition: hard cut
- Privacy check: filenames only
- Criterion: effective use of coding agents; planning artifacts

### Scene 10 — Where AI was wrong (02:49.8 – 03:11.3)
- Screen / app: two-column compare (initial vs corrected)
- File / command: refers to `docs/agenttrace-compatibility.md`, `planning/10`
- Cursor / action: static side-by-side
- Zoom / highlight: "AgentTrace ignores a flat category and re-derives from raw blocks"
- Narration: "One incorrect assumption: a flat JSONL would suffice for AgentTrace. A subagent read its parser and found analytics depend on linked tool-use and tool-result records. The design was corrected."
- Caption: same as narration
- Transition: hard cut
- Privacy check: no data shown, design text only
- Criterion: where AI made an incorrect assumption + how it was found and fixed; bugs fixed

### Scene 11 — Deliberately not built (03:11.3 – 03:29.4)
- Screen / app: list card
- File / command: refers to `planning/08-decisions-and-tradeoffs.md`
- Cursor / action: static list of four exclusions
- Zoom / highlight: "Zero runtime dependencies; hand-written ZIP and arg parser"
- Narration: "To stay focused, there is no web app, database, account system, or cloud service. Deterministic local conversion is easier to test, cheaper, and safer for sensitive logs."
- Caption: same as narration
- Transition: hard cut
- Privacy check: no data
- Criterion: what was cut/simplified; sensible trade-offs; maintainability

### Scene 12 — Weakest + next (03:29.4 – 03:46.6)
- Screen / app: two-column card (weakest vs next)
- File / command: refers to `planning/10`, `planning/12`
- Cursor / action: static side-by-side
- Zoom / highlight: "current-session resolution is heuristic"
- Narration: "The weakest area is current-session matching, because the CLI does not always receive the exact active session id. Redaction is heuristic and still needs manual review."
- Caption: same as narration
- Transition: hard cut
- Privacy check: no data
- Criterion: weakest part; next improvements

### Scene 13 — Closing (03:46.6 – 03:57.7)
- Screen / app: closing title card
- File / command: repo URL
- Cursor / action: static; four artifact bullets
- Zoom / highlight: `github.com/yoloizaac/sessionporter`
- Narration: "SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle while keeping sensitive processing local."
- Caption: same as narration
- Transition: fade to end
- Privacy check: URL only
- Criterion: recap of what the project does
