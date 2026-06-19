/** Human-readable transcript for uploading into an offline Claude conversation.
 * Pure evidence: chronological records with no model-written summaries in the
 * transcript body. A clearly separated mechanical appendix holds deterministic
 * stats with every inferred item flagged. */
import type { Category, NormalizedEvent, SessionMeta } from '../types/index.js';
import type { SessionStats } from '../core/analyze.js';

const LABEL: Record<Category, string> = {
  user_prompt: 'User prompt',
  assistant_message: 'Assistant',
  plan: 'Plan',
  tool_call: 'Tool call',
  tool_result: 'Tool result',
  command: 'Command',
  file_operation: 'File operation',
  error: 'Error',
  verification: 'Verification',
  summary: 'Session title',
  unknown: 'Unknown',
};

/** Fence content so embedded backticks cannot break out of the code block. */
function fenced(text: string): string {
  const longest = (text.match(/`+/g) ?? ['']).reduce((m, s) => Math.max(m, s.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text}\n${fence}`;
}

export interface TranscriptContext {
  meta: SessionMeta;
  mode: 'sanitized' | 'private';
  exportedAt: string;
  events: NormalizedEvent[];
  stats: SessionStats;
  completeness: string;
  warningCount: number;
}

export function buildTranscript(ctx: TranscriptContext): string {
  const { meta, events } = ctx;
  const lines: string[] = [];

  lines.push(`# Session transcript: ${meta.title ?? meta.project ?? meta.safeSessionId}`);
  lines.push('');
  lines.push(
    `_Source: **${meta.source}** | Session: \`${meta.safeSessionId}\`` +
      `${meta.project ? ` | Project: ${meta.project}` : ''} | Exported: ${ctx.exportedAt} | Mode: **${ctx.mode}**_`,
  );
  lines.push('');
  lines.push('> **Completeness.** ' + ctx.completeness);
  lines.push('>');
  lines.push(
    '> This transcript contains only records the local tool exposed. Omitted messages and hidden model reasoning are NOT reconstructed. Redacted values appear as `[REDACTED_*]` markers.',
  );
  lines.push('');

  lines.push('## How to read this');
  lines.push('');
  lines.push('- Events are in source order. Each heading shows the event number, category, and role.');
  lines.push('- Commands, file paths, and tool output are shown in fenced blocks exactly as recorded (after redaction).');
  lines.push('- Items marked **(inferred)** are heuristic classifications, not facts stated by the source.');
  lines.push('- The mechanical analysis at the end is deterministic counting, not an AI judgement.');
  lines.push('');

  lines.push('## Transcript');
  lines.push('');
  for (const e of events) {
    const ts = e.timestamp ? e.timestamp : 'no timestamp';
    const inferred = e.inferred ? ' _(inferred)_' : '';
    lines.push(`### ${e.sequence}. ${LABEL[e.category]} — ${e.role}${inferred}`);
    lines.push(`_${ts}${e.toolName ? ` · tool: ${e.toolName}` : ''}${e.status !== 'unknown' ? ` · status: ${e.status}` : ''}_`);
    if (e.command) {
      lines.push('');
      lines.push('Command:');
      lines.push(fenced(e.command));
    }
    if (e.filePath) {
      lines.push('');
      lines.push(`File: \`${e.filePath}\``);
    }
    if (e.content && e.content !== e.command) {
      lines.push('');
      const body = e.content;
      if (body.length > 1200) {
        lines.push('<details><summary>Content (long, click to expand)</summary>');
        lines.push('');
        lines.push(fenced(body));
        lines.push('');
        lines.push('</details>');
      } else if (e.category === 'user_prompt' || e.category === 'assistant_message') {
        lines.push(body.split('\n').map((l) => `> ${l}`).join('\n'));
      } else {
        lines.push(fenced(body));
      }
    }
    if (e.redactions.length > 0) {
      lines.push('');
      lines.push(`_Redacted in this event: ${e.redactions.join(', ')}._`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Mechanical analysis (deterministic, not AI)');
  lines.push('');
  lines.push(`- Events: ${ctx.stats.eventCount}`);
  lines.push(`- User prompts: ${ctx.stats.userPrompts}`);
  lines.push(`- Assistant messages: ${ctx.stats.assistantMessages}`);
  lines.push(`- Tool calls: ${ctx.stats.toolCalls}`);
  lines.push(`- Failed tool results: ${ctx.stats.failedToolResults}`);
  lines.push(`- Verification commands (inferred): ${ctx.stats.verificationCommands.length}`);
  lines.push(`- Distinct files touched: ${ctx.stats.files.length}`);
  lines.push(`- Parsing warnings: ${ctx.warningCount}`);
  lines.push('');
  lines.push(
    'Verification and any retry framing are inferred from command keywords; treat them as hints, not confirmed facts.',
  );
  lines.push('');

  return lines.join('\n');
}
