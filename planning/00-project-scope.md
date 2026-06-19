# 00: Project scope

Date: 2026-06-20

## Problem

A developer finishes an AI coding session and wants to do something with it:
inspect it in AgentTrace, hand it to a separate offline Claude conversation for an
independent audit, keep it as evidence of AI-assisted development, or share it
after redaction. The raw local logs contain secrets, file paths, and personal
data, so they cannot be shared as-is, and each tool stores them differently.

## What SessionPorter is

A local-first CLI plus a Claude Code skill that exports exactly one selected
session into a portable, privacy-aware bundle. Claude Code is the primary source;
Codex is an experimental adapter; a manual importer handles any pasted transcript.

## Hard boundaries

- Read-only. No cloud scraping, no auth bypass, no access to unrelated
  conversations, no browser-database inspection, no exporting all history.
- "Complete session" means only the records the local tool actually exposes.
  Hidden or encrypted reasoning is never reconstructed or faked.
- Local-only. No network, no analytics, no telemetry, no external AI call. The
  tool exports records; it never executes or replays them.

## Must-have outcomes

1. Select one Claude Code session (current resolved honestly, or chosen from a
   list).
2. Sanitized export by default; private export requires explicit confirmation.
3. A redaction preview before writing.
4. A bundle with a normalized JSONL (for AgentTrace), a human transcript (for
   offline Claude), a deterministic summary, a manifest, a redaction report,
   checksums, and an optional zip.
5. Validation that fails loudly rather than reporting false success.

## Explicitly out of scope

A database, an HTTP server, a frontend, an AI-generated quality score, perfect
support for every agent-log format, and a one-click "export everything".

## Acceptance

Definition of done is the checklist in the brief; the requirement-by-requirement
audit is `planning/12-final-audit.md`.
