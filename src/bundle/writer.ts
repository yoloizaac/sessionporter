/** Orchestrate writing a bundle: generate all files in memory, checksum them,
 * write atomically into a contained directory, then validate. */
import { join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import type { ExportMode, NormalizedEvent, SessionMeta } from '../types/index.js';
import { sanitizeName, assertWithin, ensureDir, atomicWrite, findGitRoot } from '../security/paths.js';
import { SessionPorterError } from '../core/errors.js';
import type { RedactionSummary } from '../redact/redactor.js';
import { analyzeEvents } from '../core/analyze.js';
import { toAgentTraceJsonl, toNormalizedEventsJsonl } from './agenttrace.js';
import { buildTranscript } from './transcript.js';
import { buildSummary } from './summary.js';
import { buildRedactionReport } from './redactionReport.js';
import { buildBundleReadme } from './readme.js';
import { buildManifest } from './manifest.js';
import { buildChecksumsFile, sha256 } from './checksums.js';
import { signChecksums, SIGNATURE_FILE } from './signing.js';
import { createZip } from './zip.js';
import { validateBundle, type ValidationResult } from '../validate/validate.js';

export interface WriteBundleArgs {
  meta: SessionMeta;
  mode: ExportMode;
  events: NormalizedEvent[];
  redaction: RedactionSummary;
  rulesRan: string[];
  warnings: string[];
  truncationCount: number;
  completeness: string;
  knownComplete: boolean;
  exportRoot: string;
  exportedAt: string;
  includeRaw: boolean;
  makeZip: boolean;
  /** When present, sign the bundle's checksums with this ed25519 private key (PEM). */
  signing?: { privateKeyPem: string };
}

export interface BundleResult {
  bundleDir: string;
  zipPath: string | null;
  files: { normalized: string; transcript: string; summary: string; redactionReport: string; manifest: string; signature: string | null };
  validation: ValidationResult;
  gitWarning: string | null;
  /** Public-key fingerprint of the signer, when the bundle was signed. */
  signatureFingerprint: string | null;
}

export async function writeBundle(args: WriteBundleArgs): Promise<BundleResult> {
  const { meta, mode, events, exportedAt } = args;
  const stats = analyzeEvents(events);

  const safeName = sanitizeName(meta.title ?? meta.project ?? meta.safeSessionId, meta.safeSessionId);
  const tsSafe = exportedAt.replace(/[:.]/g, '-');
  const folderName = sanitizeName(`sessionporter-${meta.source}-${safeName}-${tsSafe}`);
  const bundleDir = assertWithin(args.exportRoot, folderName);

  // Refuse to overwrite an existing export.
  try {
    await stat(bundleDir);
    throw new SessionPorterError('OUTPUT_EXISTS', `An export already exists at ${bundleDir}. Move or remove it first.`);
  } catch (err) {
    if (err instanceof SessionPorterError) throw err;
    // ENOENT is expected.
  }

  const gitRoot = await findGitRoot(args.exportRoot);
  const gitWarning = gitRoot
    ? `Export directory is inside a Git working tree (${gitRoot}). Ensure .sessionporter/ is gitignored before committing.`
    : null;

  const completeness = args.completeness;
  const content: Record<string, string> = {
    'session.normalized.jsonl': toAgentTraceJsonl(events),
    'session.events.jsonl': toNormalizedEventsJsonl(events),
    'session.transcript.md': buildTranscript({
      meta, mode, exportedAt, events, stats, completeness, warningCount: args.warnings.length,
    }),
    'session.summary.md': buildSummary({
      meta, mode, exportedAt, stats, redaction: args.redaction,
      warningCount: args.warnings.length, truncationCount: args.truncationCount, completeness,
    }),
    'REDACTION_REPORT.md': buildRedactionReport({
      mode, redaction: args.redaction, rulesRan: args.rulesRan,
      manualReviewRecommended: args.redaction.total > 0,
    }),
    'README.md': buildBundleReadme({ meta, mode, exportedAt, includesRaw: args.includeRaw, completeness }),
  };

  if (args.includeRaw && mode === 'private') {
    try {
      const raw = await readFile(meta.filePath, 'utf8');
      content['session.raw.jsonl'] = raw;
    } catch {
      args.warnings.push('Could not read the raw session file; raw export omitted.');
    }
  }

  // Checksums of content files only (manifest cannot contain its own hash).
  const contentChecksums: Record<string, string> = {};
  for (const [name, body] of Object.entries(content)) contentChecksums[name] = sha256(body);

  const fileList = [...Object.keys(content), 'manifest.json', 'checksums.sha256'];
  const manifest = buildManifest({
    source: meta.source,
    sourceSessionId: mode === 'sanitized' ? meta.safeSessionId : meta.sessionId,
    exportedAt,
    mode,
    eventCount: events.length,
    files: fileList,
    contentChecksums,
    redaction: args.redaction,
    warnings: args.warnings,
    completeness: { knownComplete: args.knownComplete, reason: completeness },
  });
  const manifestStr = JSON.stringify(manifest, null, 2) + '\n';

  // checksums.sha256 covers everything except itself.
  const forChecksum: Record<string, string> = { ...content, 'manifest.json': manifestStr };
  const checksumsStr = buildChecksumsFile(forChecksum);

  // Optional provenance: sign the checksums bytes. signature.json is a sidecar,
  // deliberately not listed in checksums (it is derived from them) nor in the
  // manifest (so signing leaves every other file byte-identical).
  let signatureStr: string | null = null;
  let signatureFingerprint: string | null = null;
  if (args.signing) {
    const sig = signChecksums(checksumsStr, args.signing.privateKeyPem, exportedAt);
    signatureStr = JSON.stringify(sig, null, 2) + '\n';
    signatureFingerprint = sig.publicKeyFingerprint;
  }

  // Write everything atomically into a contained dir.
  await ensureDir(bundleDir);
  const allFiles: Record<string, string> = { ...content, 'manifest.json': manifestStr, 'checksums.sha256': checksumsStr };
  if (signatureStr) allFiles[SIGNATURE_FILE] = signatureStr;
  for (const [name, body] of Object.entries(allFiles)) {
    const target = assertWithin(bundleDir, name);
    await atomicWrite(target, body);
  }

  let zipPath: string | null = null;
  if (args.makeZip) {
    const zipBuf = createZip(Object.entries(allFiles).map(([name, body]) => ({ name, data: Buffer.from(body, 'utf8') })));
    zipPath = assertWithin(args.exportRoot, `${folderName}.zip`);
    await atomicWrite(zipPath, zipBuf);
  }

  const validation = await validateBundle(bundleDir);
  if (!validation.ok) {
    throw new SessionPorterError('VALIDATION_FAILED', `Bundle validation failed: ${validation.errors.join('; ')}`);
  }

  return {
    bundleDir,
    zipPath,
    files: {
      normalized: join(bundleDir, 'session.normalized.jsonl'),
      transcript: join(bundleDir, 'session.transcript.md'),
      summary: join(bundleDir, 'session.summary.md'),
      redactionReport: join(bundleDir, 'REDACTION_REPORT.md'),
      manifest: join(bundleDir, 'manifest.json'),
      signature: signatureStr ? join(bundleDir, SIGNATURE_FILE) : null,
    },
    validation,
    gitWarning,
    signatureFingerprint,
  };
}
