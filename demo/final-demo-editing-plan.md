# Final demo editing plan

## Pipeline

```
final-replay/ (HTML + scenes.js)
   │  Playwright headless Chromium, 1280x720, 1x DPR
   ▼
out/page-*.webm        (lossless screen capture of the replay)
   │  ffmpeg -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an
   ▼
final-demo-captioned.mp4   (3:57.68, the reference deliverable)
   │  + System.Speech TTS per scene → mux with adelay/amix
   ▼
final-demo-ai-voice-draft.mp4   (same picture, synthetic voice, for review)
```

Driver script: `final-demo-run.ps1` (picture) and `final-demo-voice.ps1`
(AI-voice draft). Both are deterministic and offline.

## Why a replay rather than a desktop screen recording

- The captured surface contains only the styled replay, so there is no risk of a
  notification, an unrelated tab, or a private path leaking into frame.
- Every line is the real, verified output from `demo-capture.txt`, so the replay
  is faithful, not fabricated. The on-screen badge states it is a replay.
- It is fully reproducible from source on any machine with Node + ffmpeg.

## Caption strategy

- Captions are burned into the replay's bottom bar (one sentence per scene) and
  also shipped as `final-demo-captions.srt`. Both are generated from the same
  text, so they cannot drift.
- Caption windows equal scene windows; see `final-demo-shot-list.md` for the
  per-scene timecodes.

## Timing

- 13 scenes. Scene durations in `scenes.js` were tuned so the full render lands
  in the 3:45–4:20 window. The earlier cut was 4:36; durations were scaled by
  0.86 to reach 3:57.
- Recording overhead (initial 0.4 s lead-in + 0.8 s flush) is ~1.2 s beyond the
  scene sum of 236.5 s, giving 237.68 s measured.

## Audio (AI-voice draft only)

- One WAV per scene from Windows `System.Speech.Synthesis` (offline). No online
  TTS is used.
- Each WAV is delayed to its scene start with `adelay`, then all are mixed with
  `amix` and muxed onto the picture. Where a scene's narration is longer than its
  window, the voice continues briefly into the next scene; this is acceptable for
  a review draft and is labelled as such.
- The applicant can replace this track with their own voice over the same
  picture without re-rendering the video.

## What is NOT edited in

- No background music, no stock footage, no transitions beyond hard cuts and a
  final fade. Keeping it plain matches the tool's character and avoids implying
  capabilities the project does not have.
