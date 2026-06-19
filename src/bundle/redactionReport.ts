/** REDACTION_REPORT.md — never prints an original secret. Only category, count,
 * and the event sequence numbers affected. */
import type { ExportMode } from '../types/index.js';
import type { RedactionSummary } from '../redact/redactor.js';

const CATEGORY_NOTES: Record<string, string> = {
  private_key: 'PEM private-key blocks. Low false-positive risk.',
  connection_string: 'Credentials embedded in URLs (db / git remotes). Low false-positive risk.',
  token: 'Bearer / authorization tokens and JWTs. Low false-positive risk.',
  cookie: 'Cookie / Set-Cookie headers. May over-match a benign "cookie:" line.',
  jwt: 'JWT-shaped strings. Low false-positive risk.',
  webhook: 'Slack / Discord webhook URLs whose path is a secret. Low false-positive risk.',
  env_secret: 'KEY=VALUE pairs whose key name implies a secret. May miss oddly named secrets (false negative).',
  password: 'password / pwd fields. May over-match the literal word in prose (false positive).',
  api_key: 'Known provider key prefixes (sk-, gh*_, AKIA, AIza, xox*, glpat-). Misses unknown vendor formats (false negative).',
  user_term: 'User-supplied redaction terms from .sessionporter.json.',
  email: 'Email addresses. May redact addresses that were not sensitive.',
  home_path: 'Home-directory user names in absolute paths.',
  ip: 'Public IPv4 addresses (private/loopback ranges are kept).',
};

export interface RedactionReportContext {
  mode: ExportMode;
  redaction: RedactionSummary;
  rulesRan: string[];
  manualReviewRecommended: boolean;
}

export function buildRedactionReport(ctx: RedactionReportContext): string {
  const { redaction } = ctx;
  const l: string[] = [];
  l.push('# Redaction report');
  l.push('');
  l.push(`Mode: **${ctx.mode}**. Total redactions: **${redaction.total}**.`);
  l.push('');
  l.push('> This report never shows an original value. It lists only the category, the count, and the event numbers affected.');
  l.push('');

  l.push('## Rules that ran');
  l.push('');
  if (ctx.rulesRan.length === 0) l.push('_No redaction rules were active._');
  else for (const r of [...new Set(ctx.rulesRan)].sort()) l.push(`- ${r}`);
  l.push('');

  l.push('## Counts by category');
  l.push('');
  const cats = Object.keys(redaction.byCategory).sort();
  if (cats.length === 0) {
    l.push('_No values were redacted._');
  } else {
    l.push('| Category | Count | Affected events (by sequence) |');
    l.push('| --- | ---: | --- |');
    for (const cat of cats) {
      const locs = (redaction.locations[cat] ?? []).slice(0, 40).join(', ');
      const more = (redaction.locations[cat] ?? []).length > 40 ? ' …' : '';
      l.push(`| ${cat} | ${redaction.byCategory[cat]} | ${locs}${more} |`);
    }
  }
  l.push('');

  l.push('## False-positive and false-negative risks');
  l.push('');
  for (const cat of cats) {
    l.push(`- **${cat}**: ${CATEGORY_NOTES[cat] ?? 'Heuristic match.'}`);
  }
  if (cats.length === 0) l.push('_Not applicable: nothing was redacted._');
  l.push('');

  l.push('## Manual review');
  l.push('');
  if (ctx.mode === 'private') {
    l.push('This is a **private** bundle. It retains more original content; review the entire transcript before sharing.');
  } else if (ctx.manualReviewRecommended) {
    l.push('Automated redaction is heuristic and cannot catch every secret. **Review the transcript before sharing**, especially tool outputs and pasted snippets.');
  } else {
    l.push('No values were redacted, but automated detection is heuristic. Skim the transcript before sharing anything sensitive.');
  }
  l.push('');
  return l.join('\n');
}
