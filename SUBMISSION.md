# SessionPorter Submission

SessionPorter is the primary project. AgentTrace is only a compatibility target
and an optional supporting link.

## Public repository

https://github.com/yoloizaac/sessionporter

## Demo video

- Release: https://github.com/yoloizaac/sessionporter/releases/tag/assessment-v1.0.0
- Captioned video (download): https://github.com/yoloizaac/sessionporter/releases/download/assessment-v1.0.0/sessionporter-demo-captioned.mp4
- AI-voice draft (download, synthetic voice, for review): https://github.com/yoloizaac/sessionporter/releases/download/assessment-v1.0.0/sessionporter-demo-ai-voice-draft.mp4
- Captions: https://github.com/yoloizaac/sessionporter/releases/download/assessment-v1.0.0/demo-captions.srt

3 minutes 35 seconds, 1280x720, H.264. A styled replay of real, verified
SessionPorter output on synthetic data, labelled as a replay on screen.

## Exported coding-agent logs

- In repository: [`planning/agent-logs/sessionporter-build/`](./planning/agent-logs/sessionporter-build/)
  (a real sanitized SessionPorter export of a synthetic session; it validates).
- The five real subagent handoffs: [`planning/agent-handoffs/`](./planning/agent-handoffs/).
- Why the real build conversation is not exported wholesale (it was a
  multi-project session): [`planning/15-exported-agent-log-report.md`](./planning/15-exported-agent-log-report.md).

## Planning and handoff artifacts

[planning/](./planning/)

## Run locally

```
npm install
npm run build
sessionporter discover
sessionporter export --source claude --current
```

## Verification (from a clean clone)

- `npm run typecheck`: clean
- `npm run lint`: clean
- `npm run build`: green
- `npm test`: 63 passing (use the bounded worker pool on a busy host:
  `npx vitest run --pool=forks --poolOptions.forks.maxForks=2`)
- `npm run test:security`: 26 passing
- `npm run validate:fixtures`: OK, fixtures synthetic

## Important trade-offs

A local CLI with zero runtime dependencies; no database, no server, no cloud, no
external AI API. Sanitized export is the default; private mode needs explicit
confirmation. AgentTrace compatibility uses AgentTrace-native records (a
correction found by a portability subagent).

## Known limitations

Current-session resolution is a documented heuristic. Codex support is
experimental. Redaction is heuristic, so review the report before sharing. Hidden
or encrypted model reasoning is never reconstructed.
