/** session.summary.md — deterministic counts only. No subjective quality score. */
import type { SessionMeta } from '../types/index.js';
import type { SessionStats } from '../core/analyze.js';
import type { RedactionSummary } from '../redact/redactor.js';

export interface SummaryContext {
  meta: SessionMeta;
  mode: 'sanitized' | 'private';
  exportedAt: string;
  stats: SessionStats;
  redaction: RedactionSummary;
  warningCount: number;
  truncationCount: number;
  completeness: string;
}

export function buildSummary(ctx: SummaryContext): string {
  const { stats } = ctx;
  const l: string[] = [];
  l.push(`# Session summary`);
  l.push('');
  l.push(`- Source: ${ctx.meta.source}`);
  l.push(`- Session: \`${ctx.meta.safeSessionId}\`${ctx.meta.project ? ` (project: ${ctx.meta.project})` : ''}`);
  l.push(`- Exported: ${ctx.exportedAt} (mode: ${ctx.mode})`);
  l.push('');
  l.push('## Counts');
  l.push('');
  l.push(`- User prompts: ${stats.userPrompts}`);
  l.push(`- Assistant messages: ${stats.assistantMessages}`);
  l.push(`- Tool calls: ${stats.toolCalls}`);
  l.push(`- Failed tool results: ${stats.failedToolResults}`);
  l.push(`- Distinct files mentioned: ${stats.files.length}`);
  l.push(`- Verification commands detected (inferred): ${stats.verificationCommands.length}`);
  l.push(`- Parsing warnings: ${ctx.warningCount}`);
  l.push(`- Truncated events: ${ctx.truncationCount}`);
  l.push(`- Redactions applied: ${ctx.redaction.total}`);
  l.push('');
  l.push('## Tools used');
  l.push('');
  if (stats.toolsUsed.length === 0) l.push('_None detected._');
  else for (const t of stats.toolsUsed) l.push(`- \`${t.name}\`: ${t.count}`);
  l.push('');
  l.push('## Commands detected');
  l.push('');
  if (stats.commands.length === 0) l.push('_None detected._');
  else for (const c of stats.commands.slice(0, 50)) l.push(`- \`${c}\``);
  if (stats.commands.length > 50) l.push(`- … and ${stats.commands.length - 50} more.`);
  l.push('');
  l.push('## Files mentioned');
  l.push('');
  if (stats.files.length === 0) l.push('_None detected._');
  else for (const f of stats.files.slice(0, 80)) l.push(`- \`${f}\``);
  if (stats.files.length > 80) l.push(`- … and ${stats.files.length - 80} more.`);
  l.push('');
  l.push('## Verification commands (inferred)');
  l.push('');
  if (stats.verificationCommands.length === 0) l.push('_None detected._');
  else for (const v of stats.verificationCommands) l.push(`- \`${v}\``);
  l.push('');
  l.push('## Completeness');
  l.push('');
  l.push(ctx.completeness);
  l.push('');
  l.push('_This summary is produced by deterministic counting. It contains no "agent quality score" and no AI-generated interpretation._');
  l.push('');
  return l.join('\n');
}
