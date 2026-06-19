# Final demo evidence map

Every required narration point is mapped to the scene that carries it and to the
real repository file that backs it. This lets a reviewer jump from the video to
the source of truth. All claims are defensible against the committed code,
planning notes, and tests.

| # | Required point | Scene(s) | Repository evidence |
| --- | --- | --- | --- |
| 1 | What the project does | 1, 2, 13 | [README.md](../README.md), [SUBMISSION.md](../SUBMISSION.md) |
| 2 | AI tools / agents used | 9 | [planning/agent-handoffs/](../planning/agent-handoffs) |
| 3 | How agents helped plan | 9 | [planning/00-problem-and-scope.md](../planning/00-problem-and-scope.md) … `07` |
| 4 | How agents helped implement | 3, 9 | [src/](../src), [planning/09-agent-contributions.md](../planning/09-agent-contributions.md) |
| 5 | How agents helped debug | 10 | [planning/10-problems-and-corrections.md](../planning/10-problems-and-corrections.md) |
| 6 | How agents helped test | 8 | [tests/](../tests), `npm run test:security` |
| 7 | How agents helped review | 9 | [planning/agent-handoffs/final-security-audit.md](../planning/agent-handoffs/final-security-audit.md) |
| 8 | Features added + bugs fixed | 5, 6, 7, 10 | [src/redact/](../src/redact), [src/bundle/](../src/bundle), [planning/10](../planning/10-problems-and-corrections.md) |
| 9 | What was cut / simplified | 11 | [planning/08-decisions-and-tradeoffs.md](../planning/08-decisions-and-tradeoffs.md) |
| 10 | Weakest part | 12 | [planning/10-problems-and-corrections.md](../planning/10-problems-and-corrections.md) |
| 11 | Next improvements | 12 | [planning/08-decisions-and-tradeoffs.md](../planning/08-decisions-and-tradeoffs.md) |
| 12 | Why simple / maintainable / secure | 3, 6, 8 | [src/security/paths.ts](../src/security/paths.ts), zero runtime deps in [package.json](../package.json) |
| 13 | Where AI was wrong + how corrected | 10 | [docs/agenttrace-compatibility.md](../docs/agenttrace-compatibility.md), [planning/10](../planning/10-problems-and-corrections.md) |

## Output-number provenance

Every number shown in the terminal scenes is real and traceable:

| Shown | Meaning | Source |
| --- | --- | --- |
| `events: 17` | record count of the synthetic session | [demo/demo-capture.txt](demo-capture.txt) |
| `Total: 7` redactions | api_key 2, email 1, home_path 2, connection_string 1, token 1 | redaction preview on the fixture |
| `eventCount: 16` | manifest event count after normalization | manifest of the synthetic bundle |
| `63 passed` | full Vitest suite | `npx vitest run --pool=forks --poolOptions.forks.maxForks=2` |
| `26 passed` | security suite | `npm run test:security` |
| `7 files checked` | bundle validation | `sessionporter validate <bundle>` |

The synthetic session id `a9ca177b0cfd` and title "Add CSV export to demo-project"
are fixture values, not a real session.
