# Demo recording checklist

For re-recording the walkthrough (manual, or to replace the automated replay with
your own narration).

## Before

- Use a clean Windows Terminal window at a readable font size (18pt+).
- Close email, browser tabs, chat, and notifications. Enable Do Not Disturb.
- Point SessionPorter at the synthetic fixture so no real session is shown:
  `$env:SESSIONPORTER_CLAUDE_PROJECTS = "$PWD/fixtures/claude"`.
- `npm run build` first.

## Record only a safe region

- Capture the terminal window only, not the full desktop.
- Never show a complete private path. The fixture export shows
  `.sessionporter\exports\...` already.

## Run

- `.\demo\demo-run.ps1` (real commands, exits non-zero on failure).
- Or follow `demo-script.md` scene by scene.

## After

- Confirm duration is 3 to 5 minutes and resolution is 720p or higher
  (`ffprobe`).
- Confirm no email, no `C:\Users\<name>`, no token or key is visible.
- Confirm captions are present and synced (`demo-captions.srt`).
- Add your own narration if replacing the AI-voice draft, and do not present a
  synthetic voice as your own.

## Mistakes to avoid

- Do not show AgentTrace as the primary project; SessionPorter is primary.
- Do not claim live execution if using the replay.
- Do not scroll too fast to read.
- Do not exceed five minutes.
