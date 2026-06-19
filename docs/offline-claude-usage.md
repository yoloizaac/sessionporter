# Reviewing a session in an offline Claude conversation

SessionPorter lets you hand one of your AI coding sessions to a *separate* Claude
conversation for an independent, evidence-based audit, without leaking secrets.

## Recommended process

1. Create a **sanitized** export:
   `sessionporter export --source claude --current` (or pick a session).
2. Open `REDACTION_REPORT.md` and confirm the categories and counts look right.
   Skim `session.transcript.md` for anything the heuristics missed.
3. Start a new Claude conversation and upload **`session.transcript.md`**.
4. Optionally also upload **`session.summary.md`** for the deterministic counts.
5. Paste the evaluation prompt below and tell Claude what to focus on.
6. Do **not** upload `session.raw.*` (private mode only) unless you truly need
   full fidelity, and never to a public place.

SessionPorter does not start or control another Claude conversation for you; you
do that yourself.

## Recommended evaluation prompt

> Review the attached AI coding session as an evidence-based development audit.
>
> Evaluate:
> 1. How clearly the task was scoped and planned.
> 2. How effectively the coding agent used tools and subagents.
> 3. Whether implementation decisions were simple and maintainable.
> 4. How security and privacy were handled.
> 5. Where commands, assumptions, or implementations failed.
> 6. Whether the agent detected and corrected its mistakes.
> 7. Whether tests and verification genuinely supported its claims.
> 8. What work required human judgment.
> 9. What was unnecessarily complex or inefficient.
> 10. What should be improved in a future session.
>
> Separate your response into:
> - Directly supported observations
> - Reasonable inferences
> - Missing evidence
> - Strongest agent contributions
> - Agent failures or weak decisions
> - Human corrections and judgment
> - Security concerns
> - Overall effectiveness
> - Recommended workflow improvements
>
> Do not assume that omitted events occurred. Do not treat heuristic
> classifications as confirmed facts. Cite the relevant transcript section or
> event number for each important finding.

## Privacy warning

The transcript may contain proprietary code, file paths, command output, and
personal information even after redaction. Redaction is heuristic and cannot
catch everything. Review before sharing, and treat any private-mode bundle as
sensitive.
