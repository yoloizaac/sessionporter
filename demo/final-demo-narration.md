# Final demo narration

Total spoken time target: 3:45–4:20. The rendered video is 3:57.
Each block is one scene. The on-screen caption matches this narration word
for word (see `final-demo-captions.srt`), so the AI-voice draft, the burned-in
caption, and the sidecar caption never disagree.

Tone: plain, factual, no marketing. Forbidden phrases are avoided on purpose:
no "perfectly secure", no "catches every secret", no "fully supports every
Claude or Codex version", no "the AI built everything by itself", and
"production ready" is never used unqualified.

---

## Scene 1 — Title / what it is (00:00.4 – 00:15.9)

SessionPorter converts one selected AI coding session into a portable,
validated, privacy-aware bundle.

## Scene 2 — The problem and the workflow (00:15.9 – 00:33.1)

Logs are useful evidence but contain credentials, private paths, and
tool-specific formats. SessionPorter discovers one session, redacts, validates,
and exports.

## Scene 3 — Architecture (00:33.1 – 00:50.3)

Source-specific adapters are separate from normalization, redaction, bundle
creation, and validation. The Claude Code skill is a thin wrapper around the
same core.

## Scene 4 — Discover (00:50.3 – 01:07.5)

Discovery is read-only and returns metadata first. SessionPorter never exports
everything, and refuses to guess when the current session is ambiguous.

## Scene 5 — Inspect and redaction preview (01:07.5 – 01:28.1)

Inspect one selected session, then preview likely redactions. The report shows
categories and counts, never the original secret.

## Scene 6 — Export (01:28.1 – 01:45.3)

Sanitized mode is the default. Private mode keeps more content and requires
explicit confirmation; it never falls back silently.

## Scene 7 — The bundle (01:45.3 – 02:07.7)

The transcript preserves chronological evidence. The redaction report explains
changes, the manifest records mode and counts, and checksums make tampering
detectable.

## Scene 8 — Validate and tests (02:07.7 – 02:26.6)

The validator checks required files and SHA-256 checksums. Tests cover parsing,
normalization, redaction, archive safety, path traversal, symlinks, and network
isolation.

## Scene 9 — Agents and handoffs (02:26.6 – 02:49.8)

Claude Code was the primary agent. Focused subagents independently reviewed
formats, redaction, portability, skill UX, and final security. The main agent
integrated their handoffs.

## Scene 10 — Where AI was wrong, and the fix (02:49.8 – 03:11.3)

One incorrect assumption: a flat JSONL would suffice for AgentTrace. A subagent
read its parser and found analytics depend on linked tool-use and tool-result
records. The design was corrected.

## Scene 11 — What was deliberately cut (03:11.3 – 03:29.4)

To stay focused, there is no web app, database, account system, or cloud
service. Deterministic local conversion is easier to test, cheaper, and safer
for sensitive logs.

## Scene 12 — Weakest area and what is next (03:29.4 – 03:46.6)

The weakest area is current-session matching, because the CLI does not always
receive the exact active session id. Redaction is heuristic and still needs
manual review.

## Scene 13 — Closing (03:46.6 – 03:57.7)

SessionPorter turns one selected AI coding session into a portable, validated,
privacy-aware evidence bundle while keeping sensitive processing local.
