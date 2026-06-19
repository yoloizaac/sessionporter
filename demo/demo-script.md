# Demo script (storyline)

Target 3 to 5 minutes. The rendered video is `sessionporter-demo-captioned.mp4`.
All output is real, captured from `demo-run.ps1` on the synthetic fixture.

| Time | Scene | Shows |
| --- | --- | --- |
| 0:00 | Title | "SessionPorter / Portable, privacy-aware exports for AI coding sessions". Local-first, sanitized by default, no external AI, Claude Code supported, Codex experimental. |
| 0:09 | Problem + flow | Logs are useful evidence but contain secrets; tools differ. Flow: Discover, Select, Preview redactions, Export, Validate, Upload safely. |
| 0:29 | `discover` | Real masked session list (metadata only, no paths). |
| 0:46 | `inspect` | Selected session by safe id. |
| 0:58 | `redact-preview` | Real counts (api_key 2, email 1, home_path 2, connection_string 1, token 1, total 7). |
| 1:14 | `export` | Sanitized default; the AgentTrace and offline-Claude file paths (shown as `.sessionporter\exports`). |
| 1:30 | Bundle | File list; normalized to AgentTrace, transcript to offline Claude, no raw in sanitized. |
| 1:44 | Transcript | Real header + honest completeness note; hidden reasoning not reconstructed. |
| 2:00 | Redaction report | Category + count only, never a value. |
| 2:16 | Validate + security | "Bundle is valid (7 files checked)"; security tests 26 passed; zero egress; no replay. |
| 2:38 | AI-native evidence | planning/ + handoffs; the AgentTrace-native correction by a portability subagent. |
| 3:04 | Trade-offs | Local CLI, no DB/cloud/external model; Codex experimental; heuristics. |
| 3:22 | Close | Repo URL; "SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle." |

## Honesty notes

- The video is a styled REPLAY of verified output, labelled as such on screen.
- No private path, no real session, no unredacted secret appears.
- Numbers and command output match current verification.
