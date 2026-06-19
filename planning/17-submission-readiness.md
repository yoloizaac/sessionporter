# 17 — Submission readiness

Date: 2026-06-20

## Done

- Public repository: https://github.com/yoloizaac/sessionporter (PUBLIC, default
  branch `main`).
- `main` pushed; local and remote HEAD match.
- Topics set: claude-code, codex, ai-agents, developer-tools, privacy, typescript,
  cli.
- README renders; planning folder and agent handoffs are publicly visible.
- Demo video (captioned, 3:35) and an AI-voice draft published as Release assets
  under tag `assessment-v1.0.0`, plus the caption sidecar.
- `SUBMISSION.md` with real links (no placeholders).
- Sanitized agent-session evidence committed under
  `planning/agent-logs/sessionporter-build/` (validates); real handoffs in
  `planning/agent-handoffs/`.
- Pre-publish privacy fixes: the institutional email was removed from all
  reachable history (it was only in an unpushed submission commit), and personal
  home paths were genericized in the current files.

## Verification at submission time

`npm run typecheck` clean, `npm run lint` clean, `npm run build` green,
`npm test` 63 passing, `npm run test:security` 26 passing,
`npm run validate:fixtures` OK. Re-confirmed from a fresh clone in
`planning/18-final-publication-audit.md`.

## Honest notes

- The demo is a verified terminal replay (labelled on screen), not a live screen
  recording. No private path or real session is shown.
- The AI-voice draft uses local synthetic speech and is for review, not the
  applicant's voice.
- The personal home path `C:\Users\<name>` remains only inside the original
  build-commit blobs in deep history (the three agent handoffs). It was not
  rewritten there because rewriting the existing build history was out of scope;
  it is low sensitivity (a first name that is already in the LICENSE, and a
  reference to the already-public AgentTrace project). Current files are clean.

## Remaining manual actions for the owner

- Optionally re-record the demo with your own voice (the captioned video is
  already submittable).
- Optionally export your own real session locally with
  `sessionporter export --source claude --current` (kept out of the repo by
  design).
