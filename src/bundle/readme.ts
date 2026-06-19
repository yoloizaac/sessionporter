/** README.md inside each bundle: what each file is and how to use it safely. */
import type { ExportMode, SessionMeta } from '../types/index.js';

export interface BundleReadmeContext {
  meta: SessionMeta;
  mode: ExportMode;
  exportedAt: string;
  includesRaw: boolean;
  completeness: string;
}

export function buildBundleReadme(ctx: BundleReadmeContext): string {
  const l: string[] = [];
  l.push('# SessionPorter bundle');
  l.push('');
  l.push(`Exported ${ctx.exportedAt} from **${ctx.meta.source}** in **${ctx.mode}** mode.`);
  l.push('');
  l.push('## Files');
  l.push('');
  l.push('- `session.normalized.jsonl` — the **file to upload into AgentTrace**. One record per line in AgentTrace-native shape, with a `_sessionporter` field carrying the normalized event.');
  l.push('- `session.transcript.md` — the **file to upload into an offline Claude conversation** for a human-readable review.');
  l.push('- `session.summary.md` — deterministic counts (tools, commands, files, failures, verification). Optional second upload for context.');
  l.push('- `manifest.json` — machine-readable metadata, file list, and checksums.');
  l.push('- `REDACTION_REPORT.md` — what was redacted, by category and count (never the values). **Read this before sharing.**');
  l.push('- `checksums.sha256` — SHA-256 of every other file, for integrity checking.');
  if (ctx.includesRaw) {
    l.push('- `session.raw.jsonl` — the original records (private mode only). **Do not share publicly.**');
  }
  l.push('');
  l.push('## Which file goes where');
  l.push('');
  l.push('| Destination | File |');
  l.push('| --- | --- |');
  l.push('| AgentTrace (upload) | `session.normalized.jsonl` |');
  l.push('| Offline Claude conversation | `session.transcript.md` (optionally `session.summary.md`) |');
  l.push('');
  l.push('## Privacy');
  l.push('');
  l.push(`- This bundle is **${ctx.mode}**.`);
  if (ctx.mode === 'sanitized') {
    l.push('- Likely secrets, credentials, emails, and home-directory names were redacted to `[REDACTED_*]` markers.');
    l.push('- Raw untouched logs are **not** included.');
  } else {
    l.push('- Private mode retains more original content. Credentials and private keys are still blocked, but tool outputs may contain sensitive data.');
    l.push('- Raw logs **are** included. Treat this bundle as sensitive.');
  }
  l.push('');
  l.push('## Completeness');
  l.push('');
  l.push(ctx.completeness);
  l.push('');
  l.push('## Safe-sharing checklist');
  l.push('');
  l.push('1. Open `REDACTION_REPORT.md` and confirm the categories and counts look right.');
  l.push('2. Skim `session.transcript.md` for anything sensitive the heuristics missed.');
  l.push('3. Never upload a private bundle (or `session.raw.*`) to a public place.');
  l.push('4. Remember the transcript may contain proprietary code or personal information.');
  l.push('');
  return l.join('\n');
}
