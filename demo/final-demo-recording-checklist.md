# Final demo recording checklist

Use this before and after producing `final-demo-captioned.mp4`. Everything here
was satisfied for the committed render.

## Before recording

- [x] All terminal text comes from `demo/demo-capture.txt` (real, verified, sanitized).
- [x] The fixture is **synthetic**: session `a9ca177b0cfd`, project `demo-project`, example secret values only.
- [x] `npm run build`, `npm test` (63), `npm run test:security` (26), `npm run validate:fixtures` all pass, so the numbers on screen are current.
- [x] The replay page shows the badge "Automated replay of verified SessionPorter CLI output".
- [x] Scene durations in `final-replay/scenes.js` sum to a length that renders inside 3:45–4:20.

## Must NOT appear on screen

- [x] No real/private session content.
- [x] No API keys, tokens, or private keys.
- [x] No personal email address.
- [x] No private absolute path (`C:\Users\<name>\…`); prompts read `PS sessionporter>`, exports read `.sessionporter\exports\…`.
- [x] No unrelated repositories, browser tabs, notifications, or private pages.
- [x] No hidden model reasoning; the transcript scene states reasoning is not reconstructed.

## Narration rules

- [x] No "perfectly secure".
- [x] No "catches every secret".
- [x] No "fully supports every Claude or Codex version".
- [x] No "the AI built everything by itself".
- [x] "production ready" is not used unqualified (it is not used at all).
- [x] Caption text, narration script, and the `.srt` sidecar are identical per scene.

## After recording

- [x] `ffprobe` duration is 237.68 s (3:57.68), within 3:45–4:20 and under the 5:00 hard limit.
- [x] Container is 1280x720 H.264, faststart, no audio in the captioned reference.
- [x] Sampled frames (1 per ~12 s plus targeted grabs at scenes 5, 7, 10, 11, 12, 13) inspected for the privacy list above; all clean.
- [x] The `.mp4`/`.webm` are **not committed** (gitignored); they ship as GitHub Release assets only.
- [x] The AI-voice draft is labelled as synthetic, local TTS, for review and not the applicant's voice.
