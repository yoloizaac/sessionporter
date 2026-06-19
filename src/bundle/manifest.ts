import type { ExportMode, SourceId } from '../types/index.js';
import { SCHEMA_VERSION, EXPORTER_VERSION } from '../types/index.js';
import type { RedactionSummary } from '../redact/redactor.js';

export interface Manifest {
  schemaVersion: string;
  exporterVersion: string;
  source: SourceId;
  sourceSessionId: string;
  exportedAt: string;
  mode: ExportMode;
  eventCount: number;
  files: string[];
  checksums: Record<string, string>;
  redactionSummary: { total: number; byCategory: Record<string, number> };
  warnings: string[];
  completeness: { knownComplete: boolean; reason: string };
}

export interface ManifestArgs {
  source: SourceId;
  sourceSessionId: string;
  exportedAt: string;
  mode: ExportMode;
  eventCount: number;
  files: string[];
  contentChecksums: Record<string, string>;
  redaction: RedactionSummary;
  warnings: string[];
  completeness: { knownComplete: boolean; reason: string };
}

export function buildManifest(args: ManifestArgs): Manifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    exporterVersion: EXPORTER_VERSION,
    source: args.source,
    sourceSessionId: args.sourceSessionId,
    exportedAt: args.exportedAt,
    mode: args.mode,
    eventCount: args.eventCount,
    files: [...args.files].sort(),
    checksums: args.contentChecksums,
    redactionSummary: { total: args.redaction.total, byCategory: args.redaction.byCategory },
    warnings: args.warnings.slice(0, 200),
    completeness: args.completeness,
  };
}
