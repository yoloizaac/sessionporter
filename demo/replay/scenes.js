/* Scenes for the SessionPorter demo replay. Every command and output below is
   real, verified output from running SessionPorter against the bundled SYNTHETIC
   fixture (see demo/demo-capture.txt). Personal paths are shown as .sessionporter/exports. */
const SCENES = [
  {
    ms: 9000,
    caption: 'SessionPorter: turn one AI coding session into a portable, privacy-aware bundle. Local-first, sanitized by default, no external AI.',
    html: `<div id="title">
      <h1>SessionPorter</h1>
      <div class="sub">Portable, privacy-aware exports for AI coding sessions</div>
      <ul>
        <li>Local-first: nothing is uploaded</li>
        <li>Sanitized by default</li>
        <li>No external AI API, no network</li>
        <li>Claude Code supported, Codex experimental</li>
      </ul>
    </div>`,
  },
  {
    ms: 20000,
    caption: 'AI sessions are useful development evidence but contain secrets and private paths, and every tool stores them differently.',
    lines: [
      { t: 'The problem', cls: 'cyanline' },
      { t: '' },
      { t: '  AI coding sessions are useful evidence of how work was done.' },
      { t: '  But raw logs contain secrets, tokens, and private paths,' },
      { t: '  and Claude Code / Codex store them in different formats.' },
      { t: '' },
      { t: 'What SessionPorter does', cls: 'cyanline' },
      { t: '' },
      { t: '  Discover  ->  Select  ->  Preview redactions  ->  Export  ->  Validate  ->  Upload safely', cls: 'accent' },
    ],
  },
  {
    ms: 17000,
    caption: 'Discover lists sessions: metadata only, no content, no full paths.',
    lines: [
      { t: '> sessionporter discover --source claude', cls: 'cmd' },
      { t: '' },
      { t: '=== claude-code ===', cls: 'cyanline' },
      { t: '1. 2026-06-19T09:00:00Z  Add CSV export to demo-project' },
      { t: '   id: a9ca177b0cfd  events: 17', cls: 'dim' },
      { t: '2. ?  (untitled)' },
      { t: '   id: 2e1cfa82b035  events: 0', cls: 'dim' },
    ],
  },
  {
    ms: 12000,
    caption: 'Inspect one selected session by its safe (hashed) id.',
    lines: [
      { t: '> sessionporter inspect --source claude --session a9ca177b0cfd', cls: 'cmd' },
      { t: '' },
      { t: 'Session a9ca177b0cfd (claude-code)' },
      { t: '  Title: Add CSV export to demo-project' },
      { t: '  Project: demo-project' },
      { t: '  Records: 17' },
    ],
  },
  {
    ms: 16000,
    caption: 'Preview redactions before anything is written. The report shows counts only, never values.',
    lines: [
      { t: '> sessionporter redact-preview --source claude --session a9ca177b0cfd', cls: 'cmd' },
      { t: '' },
      { t: 'Redaction preview for a9ca177b0cfd (mode: sanitized)' },
      { t: '  api_key: 2' },
      { t: '  email: 1' },
      { t: '  home_path: 2' },
      { t: '  connection_string: 1' },
      { t: '  token: 1' },
      { t: '  Total: 7', cls: 'accent' },
    ],
  },
  {
    ms: 16000,
    caption: 'Export writes the bundle. Sanitized is the default; private mode requires an explicit confirmation.',
    lines: [
      { t: '> sessionporter export --source claude --session a9ca177b0cfd --mode sanitized', cls: 'cmd' },
      { t: '' },
      { t: 'Export complete.', cls: 'ok' },
      { t: '' },
      { t: 'Review before sharing:' },
      { t: '  .sessionporter\\exports\\...\\REDACTION_REPORT.md  (7 redactions)', cls: 'dim' },
      { t: 'Upload to AgentTrace:' },
      { t: '  .sessionporter\\exports\\...\\session.normalized.jsonl', cls: 'dim' },
      { t: 'Upload to an offline Claude conversation:' },
      { t: '  .sessionporter\\exports\\...\\session.transcript.md', cls: 'dim' },
    ],
  },
  {
    ms: 14000,
    caption: 'The bundle. normalized.jsonl goes to AgentTrace; transcript.md goes to an offline Claude conversation; no raw log in sanitized mode.',
    lines: [
      { t: '> dir <bundle>', cls: 'cmd' },
      { t: '' },
      { t: 'session.normalized.jsonl   (AgentTrace)', cls: 'ok' },
      { t: 'session.transcript.md      (offline Claude)', cls: 'ok' },
      { t: 'session.events.jsonl' },
      { t: 'session.summary.md' },
      { t: 'manifest.json' },
      { t: 'REDACTION_REPORT.md' },
      { t: 'checksums.sha256' },
      { t: 'README.md' },
    ],
  },
  {
    ms: 16000,
    caption: 'The transcript carries an honest completeness note. Hidden model reasoning is not reconstructed.',
    lines: [
      { t: '# Session transcript: Add CSV export to demo-project', cls: 'cyanline' },
      { t: '_Source: claude-code | Session: a9ca177b0cfd | Mode: sanitized_', cls: 'dim' },
      { t: '' },
      { t: '> Completeness. Records are the local Claude Code session log.' },
      { t: '  Omitted messages and hidden model reasoning are NOT reconstructed.' },
      { t: '  Redacted values appear as [REDACTED_*] markers.', cls: 'accent' },
    ],
  },
  {
    ms: 16000,
    caption: 'The redaction report lists category, count, and affected events only. It never prints a value.',
    lines: [
      { t: '# Redaction report', cls: 'cyanline' },
      { t: 'Mode: sanitized. Total redactions: 7.' },
      { t: '' },
      { t: '> This report never shows an original value. Only category, count,' },
      { t: '  and the event numbers affected.', cls: 'dim' },
      { t: '' },
      { t: '| Category | Count |' },
      { t: '| api_key  | 2     |' },
      { t: '| email    | 1     |' },
    ],
  },
  {
    ms: 22000,
    caption: 'Every bundle is validated by checksums. A test proves zero network egress. Records are exported, never executed.',
    lines: [
      { t: '> sessionporter validate <bundle>', cls: 'cmd' },
      { t: 'Bundle is valid (7 files checked).', cls: 'ok' },
      { t: '' },
      { t: '> npx vitest run tests/security', cls: 'cmd' },
      { t: '  ✓ tests/security/redaction.test.ts (17 tests)', cls: 'ok' },
      { t: '  ✓ tests/security/egress.test.ts (1 test)', cls: 'ok' },
      { t: '  ✓ tests/security/paths.test.ts (8 tests)', cls: 'ok' },
      { t: '  Tests  26 passed (26)', cls: 'accent' },
    ],
  },
  {
    ms: 26000,
    caption: 'Built with Claude Code and review subagents. A portability subagent found AgentTrace ignores a flat category, so the output became AgentTrace-native records.',
    lines: [
      { t: 'AI-native development evidence', cls: 'cyanline' },
      { t: '' },
      { t: '  planning/00..18 + planning/agent-handoffs/ (5 subagent handoffs)' },
      { t: '' },
      { t: '  Real AI correction (planning/10-problems-and-corrections.md):', cls: 'accent' },
      { t: '   - first plan: emit a flat normalized schema' },
      { t: '   - a portability subagent read AgentTrace\'s real parser' },
      { t: '   - it ignores a flat category and re-derives from raw blocks' },
      { t: '   - fix: emit AgentTrace-native records + a _sessionporter sidecar' },
    ],
  },
  {
    ms: 18000,
    caption: 'Local CLI, no database, no cloud, no external model. Codex is experimental. Current-session matching is heuristic. Redaction is heuristic, so review before sharing.',
    lines: [
      { t: 'Trade-offs and limitations', cls: 'cyanline' },
      { t: '' },
      { t: '  - a local CLI, not a web app; no database, no cloud, no external AI' },
      { t: '  - zero runtime dependencies (hand-written ZIP, arg parser)' },
      { t: '  - Codex support is experimental, fixture-tested' },
      { t: '  - current-session resolution is a documented heuristic' },
      { t: '  - redaction is heuristic: review the report before sharing' },
    ],
  },
  {
    ms: 12000,
    caption: 'SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle.',
    html: `<div id="title">
      <h1>SessionPorter</h1>
      <div class="sub">github.com/yoloizaac/sessionporter</div>
      <ul>
        <li>63 tests, lint, typecheck, build: green</li>
        <li>Zero network egress, validated bundles</li>
        <li>Sanitized by default</li>
      </ul>
    </div>`,
  },
];
