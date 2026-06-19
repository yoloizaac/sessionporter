# Demo narration script

About four minutes, one short paragraph per scene. The committed
`sessionporter-demo-ai-voice-draft.mp4` uses local Windows speech synthesis for
this text and is a DRAFT for review; it is not the applicant's voice. The
preferred final submission is the captioned video with the applicant's own
narration.

1. **Intro.** SessionPorter turns one AI coding session into a portable, privacy-aware bundle. It is local-first, sanitized by default, and uses no external AI.

2. **Problem.** AI coding sessions are useful evidence of how work was done, but the raw logs contain secrets and private paths, and Claude Code and Codex store them in different formats.

3. **Discover.** Discover lists sessions. It shows metadata only: no content, and no full paths.

4. **Inspect.** Inspect one selected session by its safe, hashed id.

5. **Preview.** Preview the redactions before anything is written. The report shows counts only, never the values.

6. **Export.** Export writes the bundle. Sanitized is the default; private mode requires an explicit confirmation.

7. **Bundle.** The bundle has the files you need. normalized.jsonl goes to AgentTrace, the transcript goes to an offline Claude conversation, and no raw log is included in sanitized mode.

8. **Transcript.** The transcript carries an honest completeness note. Hidden model reasoning is not reconstructed.

9. **Redaction report.** The redaction report lists category, count, and affected events only. It never prints a value.

10. **Validation and security.** Every bundle is validated by checksums. A test proves zero network egress. Records are exported, never executed.

11. **AI-native development.** SessionPorter was built with Claude Code and review subagents. A portability subagent read AgentTrace's real parser and found it ignores a flat category, so the output was changed to AgentTrace-native records.

12. **Trade-offs.** It is a local CLI, with no database, no cloud, and no external model. Codex support is experimental. Current-session matching is heuristic, and redaction is heuristic, so review before sharing.

13. **Close.** SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle.
