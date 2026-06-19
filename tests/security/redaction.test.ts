import { describe, it, expect } from 'vitest';
import { redactString, redactEvents } from '../../src/redact/redactor.js';
import { DEFAULT_CONFIG, SCHEMA_VERSION, type NormalizedEvent } from '../../src/types/index.js';

const cfg = { ...DEFAULT_CONFIG, redactTerms: ['ProjectCodename'] };
const san = (t: string) => redactString(t, { mode: 'sanitized', config: cfg });
const priv = (t: string) => redactString(t, { mode: 'private', config: cfg });

describe('redaction: credential patterns (always blocked)', () => {
  it('redacts an OpenAI-style key', () => {
    const r = san('here sk-FAKEKEY1234567890ABCDEFGHIJ ok');
    expect(r.text).toContain('[REDACTED_API_KEY]');
    expect(r.text).not.toContain('FAKEKEY1234567890');
  });
  it('redacts GitHub, AWS, Google, Slack, GitLab keys', () => {
    expect(san('ghp_ABCDEFGHIJ1234567890abcdef').text).toContain('[REDACTED_API_KEY]');
    expect(san('AKIAIOSFODNN7EXAMPLE').text).toContain('[REDACTED_API_KEY]');
    expect(san('AIzaFAKE1234567890abcdefghij1234567').text).toContain('[REDACTED_API_KEY]');
    expect(san('xoxb-FAKE-1234567890').text).toContain('[REDACTED_API_KEY]');
    expect(san('glpat-FAKE1234567890abcd').text).toContain('[REDACTED_API_KEY]');
    expect(san('sk_live_FAKE1234567890abcdef').text).toContain('[REDACTED_API_KEY]');
  });
  it('redacts Slack/Discord webhook URLs', () => {
    expect(san('https://hooks.slack.com/services/T000/B000/XXXfakeYYY').text).toContain('[REDACTED_TOKEN]');
    expect(san('https://hooks.slack.com/services/T000/B000/XXXfakeYYY').text).not.toContain('XXXfakeYYY');
  });
  it('redacts bearer tokens and cookies and JWTs', () => {
    expect(san('Authorization: Bearer abcdef1234567890token').text).toContain('[REDACTED_TOKEN]');
    expect(san('Cookie: session=abc123def456').text).toContain('[REDACTED_TOKEN]');
    expect(san('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkw.SflKxwRJSMeKKF2QTabcdef').text).toContain('[REDACTED_TOKEN]');
  });
  it('redacts a PEM private key block (multi-line)', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOwIBAAJBAKj\nfakekeymaterial\n-----END RSA PRIVATE KEY-----';
    const r = san(`before\n${pem}\nafter`);
    expect(r.text).toContain('[REDACTED_SECRET]');
    expect(r.text).not.toContain('fakekeymaterial');
    expect(r.text).toContain('before');
    expect(r.text).toContain('after');
  });
  it('redacts password fields and env secrets', () => {
    expect(san('password=hunter2value').text).toContain('[REDACTED_SECRET]');
    expect(san('API_KEY=supersecretvalue').text).toContain('[REDACTED_SECRET]');
    expect(san('API_KEY=supersecretvalue').text).not.toContain('supersecretvalue');
  });
  it('redacts connection-string credentials but keeps the host', () => {
    const r = san('DATABASE_URL=postgres://admin:secretpass@db.example.com:5432/app');
    expect(r.text).not.toContain('secretpass');
    expect(r.text).toContain('db.example.com');
  });
  it('redacts git remotes with embedded credentials', () => {
    const r = san('git remote https://user:ghp_tokenvalue1234@github.com/acme/repo.git');
    expect(r.text).not.toContain('ghp_tokenvalue1234');
    expect(r.text).toContain('github.com');
  });
});

describe('redaction: identity / locality (sanitized only)', () => {
  it('redacts emails in sanitized but keeps them in private', () => {
    expect(san('contact devuser@example.com').text).toContain('[REDACTED_EMAIL]');
    expect(priv('contact devuser@example.com').text).toContain('devuser@example.com');
  });
  it('redacts home directory names, keeping the prefix', () => {
    expect(san('C:\\Users\\bob\\proj').text).toBe('C:\\Users\\[REDACTED_HOME]\\proj');
    expect(san('/home/bob/proj').text).toBe('/home/[REDACTED_HOME]/proj');
    expect(san('/Users/bob/proj').text).toBe('/Users/[REDACTED_HOME]/proj');
  });
  it('redacts user-supplied terms', () => {
    expect(san('the ProjectCodename launch').text).toContain('[REDACTED_SECRET]');
  });
  it('redacts public IPs but keeps private/loopback', () => {
    expect(san('8.8.8.8').text).toBe('[REDACTED_IP]');
    expect(san('192.168.1.5').text).toBe('192.168.1.5');
    expect(san('127.0.0.1').text).toBe('127.0.0.1');
  });
});

describe('redaction: text that resembles but is not a secret', () => {
  it('leaves an ordinary version number alone', () => {
    expect(san('version 1.2.3 released').text).toBe('version 1.2.3 released');
  });
  it('leaves a normal sentence with the word token alone-ish', () => {
    // "token" without an assignment is not redacted
    expect(san('the design token system').text).toBe('the design token system');
  });
});

describe('redaction: idempotency and private-mode floor', () => {
  it('is idempotent (re-redacting changes nothing)', () => {
    const once = san('key sk-FAKEKEY1234567890ABCDEFGHIJ and devuser@example.com');
    const twice = san(once.text);
    expect(twice.text).toBe(once.text);
  });
  it('private mode still blocks credentials and private keys', () => {
    expect(priv('sk-FAKEKEY1234567890ABCDEFGHIJ').text).toContain('[REDACTED_API_KEY]');
    expect(priv('postgres://admin:secretpass@db.example.com/app').text).not.toContain('secretpass');
  });
});

function ev(content: string, seq: number): NormalizedEvent {
  return {
    schemaVersion: SCHEMA_VERSION, id: `e${seq}`, sessionId: 's', source: 'claude-code',
    timestamp: null, sequence: seq, role: 'user', category: 'user_prompt', title: 't',
    content, toolName: null, toolCallId: null, command: null, filePath: null,
    status: 'unknown', inferred: false, sourceType: 'text', redactions: [],
  };
}

describe('redaction report safety', () => {
  it('summary records counts and event locations, never values', () => {
    const events = [ev('sk-FAKEKEY1234567890ABCDEFGHIJ', 1), ev('plain text', 2), ev('devuser@example.com', 3)];
    const { events: out, summary } = redactEvents(events, { mode: 'sanitized', config: cfg });
    expect(summary.total).toBeGreaterThanOrEqual(2);
    expect(summary.byCategory.api_key).toBe(1);
    expect(summary.locations.api_key).toEqual([1]);
    // The summary must not contain any original value.
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain('FAKEKEY');
    expect(blob).not.toContain('devuser@example.com');
    // Redacted event carries category labels only.
    expect(out[0].redactions).toContain('api_key');
    expect(out[0].content).not.toContain('FAKEKEY');
  });
});
