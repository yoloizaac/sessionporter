# 19 — Final demo production

Date: 2026-06-20

## What was produced

| Artifact | Path | Notes |
| --- | --- | --- |
| Captioned demo (reference) | `demo/final-demo-captioned.mp4` | 1280x720 H.264, 3:57.68, no audio, burned-in captions |
| AI-voice draft | `demo/final-demo-ai-voice-draft.mp4` | same picture + local System.Speech narration, 3:56.65 |
| Caption sidecar | `demo/final-demo-captions.srt` | one cue per scene, matches the burned-in text |
| Shot list | `demo/final-demo-shot-list.md` | 13 scenes with timecodes, privacy check, criterion |
| Narration script | `demo/final-demo-narration.md` | identical text to captions and `.srt` |
| Evidence map | `demo/final-demo-evidence-map.md` | required points → scene → repo file; number provenance |
| Recording checklist | `demo/final-demo-recording-checklist.md` | pre/post + privacy + narration rules |
| Editing plan | `demo/final-demo-editing-plan.md` | pipeline, caption strategy, timing, audio |
| Picture driver | `demo/final-demo-run.ps1` | record → convert → verify duration |
| Voice driver | `demo/final-demo-voice.ps1` | per-scene TTS → adelay/amix → mux |
| Replay source | `demo/final-replay/{index.html,scenes.js}` | 13-scene replay, all real verified output |

The two `.mp4` files are **gitignored**; they ship as GitHub Release assets only.

## Method

The video is an automated **terminal replay**, not a desktop screen recording.
The replay HTML renders real, verified output captured in `demo/demo-capture.txt`
(SessionPorter run against the bundled synthetic fixture). Playwright records the
page headless at 1280x720; ffmpeg converts WebM → H.264 MP4; ffprobe checks the
duration. Every frame carries the badge "Automated replay of verified
SessionPorter CLI output", so the footage is never presented as a live shell.

This choice keeps the capture surface free of notifications, unrelated tabs, and
private paths, and makes the whole video reproducible from source on any machine
with Node + ffmpeg.

## Duration control

The first render was 4:36, over the 4:20 target. Scene durations in
`final-replay/scenes.js` were scaled by 0.86 (scene sum 236.5 s). With the
0.4 s lead-in and 0.8 s flush, the measured render is 237.68 s = 3:57.68, inside
the 3:45–4:20 window and well under the 5:00 hard limit.

## Privacy verification

Frames were extracted (one per ~12 s, plus targeted grabs at scenes 5, 7, 10,
11, 12, 13) and inspected. Confirmed absent from every frame:

- real or private session content
- API keys, tokens, private keys (redaction scenes show category + count only,
  with the line "original secret values are never shown")
- personal email address
- private absolute path — prompts read `PS sessionporter>`, export paths read
  `.sessionporter\exports\…`
- unrelated repos, browser tabs, notifications, private pages
- hidden model reasoning — the transcript scene states reasoning is not
  reconstructed

Only synthetic fixture data appears: session `a9ca177b0cfd`, project
`demo-project`, example secret values.

## Narration constraints honored

Captions, narration script, and `.srt` are identical per scene. None of the
forbidden phrases appear: no "perfectly secure", no "catches every secret", no
"fully supports every Claude or Codex version", no "the AI built everything by
itself"; "production ready" is not used. The AI-voice draft is labelled as
synthetic local TTS for review, not the applicant's voice.

## Coverage

The 13 scenes cover every required point: what the project does (1, 2, 13); AI
tools and agents (9); how agents helped plan, implement, debug, test, review (3,
8, 9, 10); features added and bugs fixed (5, 6, 7, 10); what was cut and
simplified (11); the weakest part (12); next improvements (12); why the design is
simple, maintainable, and secure (3, 6, 8); where AI made an incorrect assumption
and how it was discovered and corrected (10). See
`demo/final-demo-evidence-map.md` for the row-by-row mapping to repository files.

## Publication

The two videos and the `.srt` are uploaded to the existing Release
`assessment-v1.0.0` (no new tag, no overwrite of an unrelated release).
`SUBMISSION.md` links the final captioned video. The source scripts and replay
files are committed; the rendered binaries are not.
