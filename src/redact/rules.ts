/**
 * Redaction rules, ordered. `always` rules run in every mode (private mode still
 * blocks credentials); `sanitized` rules run only in the default sanitized mode.
 * Replacement tokens never reveal the original value.
 *
 * False-positive / false-negative notes are in planning/03-redaction-model.md.
 */
import type { SessionPorterConfig } from '../types/index.js';

export type RuleMode = 'always' | 'sanitized';

export interface RedactRule {
  category: string;
  token: string;
  mode: RuleMode;
  /** Global regex. The matched span is replaced by `token` or `replace`. */
  pattern: RegExp;
  /** Optional replacement string (may reference capture groups, e.g. "$1[REDACTED]"). */
  replace?: string;
}

const T = {
  apiKey: '[REDACTED_API_KEY]',
  token: '[REDACTED_TOKEN]',
  secret: '[REDACTED_SECRET]',
  email: '[REDACTED_EMAIL]',
  home: '[REDACTED_HOME]',
  ip: '[REDACTED_IP]',
} as const;

/** Always-on rules: credentials that must never leak, in any mode. */
const ALWAYS: RedactRule[] = [
  {
    category: 'private_key',
    token: T.secret,
    mode: 'always',
    // PEM private key block (RSA/EC/OPENSSH/generic), across lines.
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    category: 'connection_string',
    token: T.secret,
    mode: 'always',
    // scheme://user:pass@host  (covers db URLs and git remotes with creds)
    pattern: /([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s:@]+@/gi,
    replace: `$1${T.secret}@`,
  },
  {
    category: 'token',
    token: T.token,
    mode: 'always',
    // Authorization: Bearer <token>  /  bearer <token>
    pattern: /\b(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._\-+/=]{8,}/gi,
  },
  {
    category: 'cookie',
    token: T.token,
    mode: 'always',
    pattern: /\b(?:set-)?cookie\s*[:=]\s*[^\r\n]+/gi,
  },
  {
    category: 'jwt',
    token: T.token,
    mode: 'always',
    // three base64url segments
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    category: 'webhook',
    token: T.token,
    mode: 'always',
    // Slack / Discord incoming-webhook URLs carry a secret token in the path.
    pattern: /https:\/\/(?:hooks\.slack\.com\/services|discord(?:app)?\.com\/api\/webhooks)\/[A-Za-z0-9_/-]+/gi,
  },
  {
    category: 'env_secret',
    token: T.secret,
    mode: 'always',
    // KEY=VALUE / "key": "value" where the key name looks secret-bearing
    pattern:
      /\b([A-Za-z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PASSWD|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET)[A-Za-z0-9_]*)("?\s*[:=]\s*"?)([^\s"',}]+)/gi,
    replace: `$1$2${T.secret}`,
  },
  {
    category: 'password',
    token: T.secret,
    mode: 'always',
    pattern: /\b(pass(?:word|wd)?|pwd)("?\s*[:=]\s*"?)([^\s"',}]{3,})/gi,
    replace: `$1$2${T.secret}`,
  },
  {
    category: 'api_key',
    token: T.apiKey,
    mode: 'always',
    // Common provider key shapes.
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{16,}|(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|gh[posru]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{16,})\b/g,
  },
];

/** Sanitized-only rules: identity and locality, kept in private mode. */
function sanitizedRules(config: SessionPorterConfig): RedactRule[] {
  const rules: RedactRule[] = [];

  // User-supplied sensitive terms (literal, case-insensitive).
  for (const term of config.redactTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped.length === 0) continue;
    rules.push({
      category: 'user_term',
      token: T.secret,
      mode: 'sanitized',
      pattern: new RegExp(escaped, 'gi'),
    });
  }

  if (config.redactEmails) {
    rules.push({
      category: 'email',
      token: T.email,
      mode: 'sanitized',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    });
  }

  if (config.redactHomeDirectory) {
    rules.push({
      category: 'home_path',
      token: T.home,
      mode: 'sanitized',
      // Windows: C:\Users\<name>
      pattern: /([A-Za-z]:\\Users\\)([^\\/\s"']+)/g,
      replace: `$1${T.home}`,
    });
    rules.push({
      category: 'home_path',
      token: T.home,
      mode: 'sanitized',
      // POSIX: /home/<name> or /Users/<name>
      pattern: /(\/(?:home|Users)\/)([^/\s"']+)/g,
      replace: `$1${T.home}`,
    });
  }

  // Public IPv4 only — private/loopback ranges are kept (they aid readability and are not sensitive).
  rules.push({
    category: 'ip',
    token: T.ip,
    mode: 'sanitized',
    pattern:
      /\b(?!(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.))(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  });

  return rules;
}

export function rulesFor(mode: 'sanitized' | 'private', config: SessionPorterConfig): RedactRule[] {
  if (mode === 'private') return [...ALWAYS];
  return [...ALWAYS, ...sanitizedRules(config)];
}

/** Categories that are credentials (used to gate the deliberate no-redaction override). */
export const CREDENTIAL_CATEGORIES = new Set(
  ALWAYS.map((r) => r.category),
);
