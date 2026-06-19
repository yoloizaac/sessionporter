/* Final demo scenes. All command output is real, captured from running
   SessionPorter against the bundled SYNTHETIC fixture (demo/demo-capture.txt).
   Personal paths render as .sessionporter\exports. */
const SCENES = [
  // 1 — title + problem
  {
    ms: 15480,
    caption: 'SessionPorter converts one selected AI coding session into a portable, validated, privacy-aware bundle.',
    html: `<div id="title">
      <h1>SessionPorter</h1>
      <div class="sub">Portable, privacy-aware exports for AI coding sessions</div>
      <ul>
        <li>Claude Code supported</li>
        <li>Codex experimental</li>
        <li>Local-only processing</li>
        <li>Sanitized by default</li>
      </ul>
      <div class="url">github.com/yoloizaac/sessionporter</div>
    </div>`,
  },
  // 2 — workflow
  {
    ms: 17200,
    caption: 'Logs are useful evidence but contain credentials, private paths, and tool-specific formats. SessionPorter discovers one session, redacts, validates, and exports.',
    html: `<div class="h2">The workflow</div>
      <div class="pipeline">
        <span class="step">Discover</span> <span class="arr">&rarr;</span>
        <span class="step">Select one session</span> <span class="arr">&rarr;</span>
        <span class="step">Preview redactions</span><br>
        <span class="arr">&rarr;</span> <span class="step">Export</span>
        <span class="arr">&rarr;</span> <span class="step">Validate</span>
        <span class="arr">&rarr;</span> <span class="step">Upload safely</span>
      </div>
      <div class="files">
        Output files:<br>
        <span class="f">session.normalized.jsonl</span> &nbsp; <span class="f">session.transcript.md</span> &nbsp; <span class="f">session.summary.md</span><br>
        <span class="f">manifest.json</span> &nbsp; <span class="f">REDACTION_REPORT.md</span> &nbsp; <span class="f">checksums.sha256</span>
      </div>`,
  },
  // 3 — repo structure
  {
    ms: 17200,
    caption: 'Source-specific adapters are separate from normalization, redaction, bundle creation, and validation. The Claude Code skill is a thin wrapper around the same core.',
    html: `<div class="h2">Architecture</div>
      <div class="tree">
        <div><span class="d">src/adapters/</span>      <span class="note">claude | codex | manual  (source-specific)</span></div>
        <div><span class="d">src/normalize/</span>     <span class="note">shared, tool-independent</span></div>
        <div><span class="d">src/redact/</span>        <span class="note">security boundary: rules + redactor</span></div>
        <div><span class="d">src/bundle/</span>        <span class="note">normalized, transcript, manifest, zip, checksums</span></div>
        <div><span class="d">src/validate/</span>      <span class="note">checksum + structure validation</span></div>
        <div><span class="d">skills/claude-code/export-session/</span>  <span class="note">reusable skill (thin wrapper)</span></div>
        <div><span class="d">tests/</span>             <span class="note">63 tests incl. security</span></div>
        <div><span class="d">planning/</span>          <span class="note">notes + agent handoffs (evidence)</span></div>
      </div>`,
  },
  // 4 — discover
  {
    ms: 17200,
    caption: 'Discovery is read-only and returns metadata first. SessionPorter never exports everything, and refuses to guess when the current session is ambiguous.',
    lines: [
      { t: 'PS sessionporter> sessionporter discover --source claude', cls: 'cmd' },
      { t: '' },
      { t: '=== claude-code ===', cls: 'cyanline' },
      { t: '1. 2026-06-19T09:00:00Z  Add CSV export to demo-project' },
      { t: '   id: a9ca177b0cfd  events: 17', cls: 'dim' },
      { t: '2. ?  (untitled)' },
      { t: '   id: 2e1cfa82b035  events: 0', cls: 'dim' },
    ],
  },
  // 5 — inspect + redact preview
  {
    ms: 20640,
    caption: 'Inspect one selected session, then preview likely redactions. The report shows categories and counts, never the original secret.',
    lines: [
      { t: 'PS sessionporter> sessionporter inspect --source claude --session a9ca177b0cfd', cls: 'cmd' },
      { t: 'Session a9ca177b0cfd (claude-code)' },
      { t: '  Title: Add CSV export to demo-project   Project: demo-project   Records: 17', cls: 'dim' },
      { t: '' },
      { t: 'PS sessionporter> sessionporter redact-preview --source claude --session a9ca177b0cfd', cls: 'cmd' },
      { t: 'Redaction preview for a9ca177b0cfd (mode: sanitized)' },
      { t: '  api_key: 2   email: 1   home_path: 2   connection_string: 1   token: 1' },
      { t: '  Total: 7', cls: 'accent' },
      { t: '  (original secret values are never shown)', cls: 'dim' },
    ],
  },
  // 6 — export
  {
    ms: 17200,
    caption: 'Sanitized mode is the default. Private mode keeps more content and requires explicit confirmation; it never falls back silently.',
    lines: [
      { t: 'PS sessionporter> sessionporter export --source claude --session a9ca177b0cfd --mode sanitized', cls: 'cmd' },
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
  // 7 — bundle
  {
    ms: 22360,
    caption: 'The transcript preserves chronological evidence. The redaction report explains changes, the manifest records mode and counts, and checksums make tampering detectable.',
    lines: [
      { t: 'session.normalized.jsonl  (AgentTrace)   session.transcript.md  (fresh Claude chat)', cls: 'ok' },
      { t: 'manifest.json   REDACTION_REPORT.md   checksums.sha256   session.summary.md', cls: 'dim' },
      { t: '' },
      { t: '# Session transcript: Add CSV export to demo-project', cls: 'cyanline' },
      { t: '> Completeness. Hidden model reasoning is NOT reconstructed.' },
      { t: '  Redacted values appear as [REDACTED_*] markers.', cls: 'accent' },
      { t: '' },
      { t: '# Redaction report   Mode: sanitized. Total redactions: 7.', cls: 'cyanline' },
      { t: '  | api_key | 2 |   | email | 1 |   (category + count only, never a value)', cls: 'dim' },
      { t: '' },
      { t: 'manifest.json: { "mode": "sanitized", "eventCount": 16, ... }', cls: 'dim' },
    ],
  },
  // 8 — validate + tests
  {
    ms: 18920,
    caption: 'The validator checks required files and SHA-256 checksums. Tests cover parsing, normalization, redaction, archive safety, path traversal, symlinks, and network isolation.',
    lines: [
      { t: 'PS sessionporter> sessionporter validate <bundle>', cls: 'cmd' },
      { t: 'Bundle is valid (7 files checked).', cls: 'ok' },
      { t: '' },
      { t: 'PS sessionporter> npm test', cls: 'cmd' },
      { t: '  Tests  63 passed (63)', cls: 'ok' },
      { t: 'PS sessionporter> npm run test:security', cls: 'cmd' },
      { t: '  Tests  26 passed (26)', cls: 'ok' },
      { t: '' },
      { t: '  typecheck: clean    lint: clean    build: green', cls: 'accent' },
    ],
  },
  // 9 — agent workflow
  {
    ms: 23220,
    caption: 'Claude Code was the primary agent. Focused subagents independently reviewed formats, redaction, portability, skill UX, and final security. The main agent integrated their handoffs.',
    html: `<div class="h2">Claude Code + focused review subagents</div>
      <div class="tree">
        <div><span class="d">planning/agent-handoffs/</span></div>
        <div>  session-format-investigation.md   <span class="note">Claude + Codex record taxonomy</span></div>
        <div>  redaction-security-review.md      <span class="note">redaction rules + filesystem threats</span></div>
        <div>  portability-review.md             <span class="note">read AgentTrace's real parser</span></div>
        <div>  skill-ux-review.md                <span class="note">shortest safe /export-session flow</span></div>
        <div>  final-security-audit.md           <span class="note">verdict: GO</span></div>
      </div>
      <div class="files">planning/09-agent-contributions.md &nbsp; planning/10-problems-and-corrections.md</div>`,
  },
  // 10 — AI wrong
  {
    ms: 21500,
    caption: 'One incorrect assumption: a flat JSONL would suffice for AgentTrace. A subagent read its parser and found analytics depend on linked tool-use and tool-result records. The design was corrected.',
    html: `<div class="h2">Where AI was wrong, and how it was fixed</div>
      <div class="twocol">
        <div class="col"><h3 class="bad">Initial assumption</h3>
          Emit a flat normalized JSONL.<br><br>
          AgentTrace would read the <code>category</code> field directly.</div>
        <div class="col"><h3 class="good">Corrected approach</h3>
          AgentTrace ignores a flat category and re-derives from raw blocks.<br><br>
          Emit AgentTrace-native records with linked tool_use / tool_result ids, plus a <code>_sessionporter</code> sidecar.</div>
      </div>
      <div class="files">Also fixed before publication: an AWS-key regex boundary, and an unsafe filename fallback (caught by tests).</div>`,
  },
  // 11 — cuts
  {
    ms: 18060,
    caption: 'To stay focused, there is no web app, database, account system, or cloud service. Deterministic local conversion is easier to test, cheaper, and safer for sensitive logs.',
    html: `<div class="h2">Deliberately not built</div>
      <ul class="listbig">
        <li class="no">web dashboard, database, authentication</li>
        <li class="no">cloud sync, external LLM summarization</li>
        <li class="no">automatic upload into another chat</li>
        <li class="no">claims of complete Codex compatibility</li>
      </ul>
      <div class="files">See planning/08-decisions-and-tradeoffs.md. Zero runtime dependencies; hand-written ZIP and arg parser.</div>`,
  },
  // 12 — weakest + next
  {
    ms: 17200,
    caption: 'The weakest area is current-session matching, because the CLI does not always receive the exact active session id. Redaction is heuristic and still needs manual review.',
    html: `<div class="h2">Weakest areas, and what is next</div>
      <div class="twocol">
        <div class="col"><h3 class="bad">Weakest</h3>
          current-session resolution is heuristic<br>
          redaction has false positives / negatives<br>
          Codex formats may change</div>
        <div class="col"><h3 class="good">Next</h3>
          exact active-session id handoff<br>
          versioned adapters<br>
          property-based and fuzz testing<br>
          stronger redaction review UX</div>
      </div>`,
  },
  // 13 — closing
  {
    ms: 10320,
    caption: 'SessionPorter turns one selected AI coding session into a portable, validated, privacy-aware evidence bundle while keeping sensitive processing local.',
    html: `<div id="title">
      <h1>SessionPorter</h1>
      <div class="sub">github.com/yoloizaac/sessionporter</div>
      <ul>
        <li>planning and handoffs</li>
        <li>sanitized evidence</li>
        <li>demo release</li>
        <li>reproducible tests</li>
      </ul>
    </div>`,
  },
];
