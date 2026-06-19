# Installing the /export-session skill

The Claude Code skill lives in this repo at
`skills/claude-code/export-session/SKILL.md`. It is **not** installed
automatically; installation is a manual, approval-gated step.

## Install

Copy the skill folder into your Claude Code skills directory:

```
# PowerShell
Copy-Item -Recurse skills/claude-code/export-session "$env:USERPROFILE/.claude/skills/export-session"
```

```
# bash
cp -r skills/claude-code/export-session ~/.claude/skills/export-session
```

Restart Claude Code (or reload skills) and invoke `/export-session`.

## The CLI must be reachable

The skill orchestrates the `sessionporter` CLI; it does not re-implement any
logic. Make the CLI available in one of these ways:

- Build it (`npm run build`) and let the skill call
  `node <path-to-sessionporter>/dist/cli/index.js`.
- Or link it globally: `npm run build && npm link`, then `sessionporter` is on
  PATH.

## Uninstall

Remove `~/.claude/skills/export-session/`.

## Codex

There is no separate Codex skill yet (Codex support is experimental, see
`planning/codex-adapter-investigation.md`). Use the CLI directly:
`sessionporter export --source codex --session <id>`.
