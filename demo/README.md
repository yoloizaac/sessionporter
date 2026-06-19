# Demo

A three-to-five minute walkthrough of SessionPorter, built from **real, verified**
CLI output on the bundled **synthetic** fixture (no real session, no private path).

## Files

- `demo-run.ps1` — reproducible run: real SessionPorter commands against the
  synthetic fixture. Exits non-zero if any command fails.
- `demo-capture.txt` — the captured, sanitized output of `demo-run.ps1`.
- `replay/` — a styled terminal **replay** of that verified output (the video
  source). `index.html` + `scenes.js`. Labelled "Automated replay of verified
  SessionPorter CLI output".
- `record.mjs` — Playwright recorder that renders `replay/` to a WebM.
- `demo-captions.srt` — caption sidecar, synced to the scenes.
- `demo-narration-script.md` — narration text (used for the AI-voice draft).
- `demo-recording-checklist.md` — manual recording checklist.
- `sessionporter-demo-captioned.mp4` — the captioned video (silent, on-screen
  captions). **Published as a GitHub Release asset, not committed.**
- `sessionporter-demo-ai-voice-draft.mp4` — a DRAFT with local synthetic
  narration (not the applicant's voice). Release asset.

## Reproduce

```powershell
.\demo\demo-run.ps1
```

## Rebuild the video

```powershell
$tmp = "$env:TEMP\sp-rec"; mkdir $tmp; cd $tmp; npm i playwright
node <repo>\demo\record.mjs <repo>\demo\replay out
ffmpeg -y -i out\*.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an `
  <repo>\demo\sessionporter-demo-captioned.mp4
```

The video is a replay of verified output, not a claim of live execution. It is
honest by design.
