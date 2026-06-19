# 16 — Demo video production

Date: 2026-06-20

## Method

Verified terminal **replay** (the safest option given the "no desktop capture"
rule). Real SessionPorter commands were run against the synthetic fixture
(`demo/demo-run.ps1`), their output captured (`demo/demo-capture.txt`), and a
styled terminal page (`demo/replay/`) replays that exact output with section
title cards and a synced caption bar. The page is labelled on screen "Automated
replay of verified SessionPorter CLI output", so it is honest: a replay of real
output, not a claim of live execution.

## Tools

- Playwright (Chromium headless) recorded the page to WebM, in an isolated
  tooling directory so SessionPorter's dependencies stayed unchanged.
- FFmpeg converted WebM to MP4 (H.264) and muxed the narration.
- Local Windows speech synthesis (`System.Speech`) produced the draft narration
  WAVs. No text or audio was sent to any online service.
- FFprobe verified duration and resolution.

## Source commands

The captured commands: `discover`, `inspect`, `redact-preview`, `export`,
`validate`, and `vitest run tests/security`. All real, against the synthetic
fixture.

## Output

- `sessionporter-demo-captioned.mp4`: H.264, 1280x720, 214.9s (3:35), about
  2.2 MB. On-screen captions, no audio.
- `sessionporter-demo-ai-voice-draft.mp4`: same video with aligned synthetic
  narration, about 3:30, 3.4 MB, audio mean level about -22.7 dB (audible).
- `demo-captions.srt`: caption sidecar.

## Live or replay

A verified replay, labelled as such. No footage was fabricated; every line shown
is real captured output.

## Privacy review

Frames were inspected: the title and terminal scenes show no email, no
`C:\Users\<name>` path (export paths render as `.sessionporter\exports`), and no
unredacted secret. The captured text was sanitized before use.

## Limitations

- The replay is a terminal animation, not a live screen recording.
- The AI-voice draft uses a synthetic voice and is for review only; the preferred
  final is the captioned video with the applicant's own narration.
- The narration aligns per scene but is not word-for-word lip-synced.
