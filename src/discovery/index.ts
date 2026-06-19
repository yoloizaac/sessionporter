/** Adapter registry. The only place that knows the concrete adapters. */
import type { Adapter, SourceId } from '../types/index.js';
import { createClaudeAdapter } from '../adapters/claude/index.js';
import { createCodexAdapter } from '../adapters/codex/index.js';

export function getAdapters(): Adapter[] {
  return [createClaudeAdapter(), createCodexAdapter()];
}

export function getAdapter(id: SourceId): Adapter | null {
  return getAdapters().find((a) => a.id === id) ?? null;
}

export async function availableAdapters(): Promise<Adapter[]> {
  const all = getAdapters();
  const flags = await Promise.all(all.map((a) => a.isAvailable()));
  return all.filter((_, i) => flags[i]);
}
