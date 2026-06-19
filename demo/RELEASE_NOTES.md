# SessionPorter — Technical Assessment Submission

SessionPorter exports one selected AI coding session into a portable,
privacy-aware bundle for AgentTrace and for an offline Claude review. Local-first,
sanitized by default, zero runtime dependencies, no network.

## Assets in this release

- `sessionporter-demo-captioned.mp4` — the 3.5 minute walkthrough (on-screen
  captions). A styled replay of real, verified SessionPorter output on synthetic
  data.
- `sessionporter-demo-ai-voice-draft.mp4` — the same walkthrough with a local
  synthetic narration. A DRAFT for review; not the applicant's voice.
- `demo-captions.srt` — caption sidecar.
- `sessionporter-agent-evidence.zip` (optional) — the sanitized synthetic export
  bundle (also in the repo under `planning/agent-logs/sessionporter-build/`).

## Exported coding-agent evidence

The genuine agent artifacts are the planning folder and five subagent handoffs in
the repository. The real build conversation was a multi-project Claude Code
session and is intentionally not exported wholesale; see
`planning/15-exported-agent-log-report.md`.

## Verification (from a clean clone)

`npm run typecheck`, `npm run lint`, `npm run build` pass; `npm test` is 63
passing; `npm run test:security` passes; `npm run validate:fixtures` is OK.

## Privacy

Sanitized mode redacts credentials, keys, tokens, emails, and home paths to
`[REDACTED_*]` markers. No raw logs and no private-mode output are published. The
video shows no real session and no private path.
