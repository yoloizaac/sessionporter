/** Deterministic, local analysis of normalized events. No external API, no
 * subjective "quality score" — only counts and lists derived from the data. */
import type { NormalizedEvent } from '../types/index.js';

export interface SessionStats {
  eventCount: number;
  userPrompts: number;
  assistantMessages: number;
  toolCalls: number;
  failedToolResults: number;
  toolsUsed: { name: string; count: number }[];
  commands: string[];
  files: string[];
  verificationCommands: string[];
}

const TOOL_CATEGORIES = new Set(['tool_call', 'command', 'file_operation', 'verification', 'plan']);

export function analyzeEvents(events: NormalizedEvent[]): SessionStats {
  const toolCounts = new Map<string, number>();
  const commands = new Set<string>();
  const files = new Set<string>();
  const verification = new Set<string>();
  let userPrompts = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let failedToolResults = 0;

  for (const e of events) {
    if (e.category === 'user_prompt') userPrompts += 1;
    if (e.category === 'assistant_message') assistantMessages += 1;
    if (TOOL_CATEGORIES.has(e.category)) toolCalls += 1;
    if (e.status === 'failure') failedToolResults += 1;
    if (e.toolName && TOOL_CATEGORIES.has(e.category)) {
      toolCounts.set(e.toolName, (toolCounts.get(e.toolName) ?? 0) + 1);
    }
    if (e.command) commands.add(e.command);
    if (e.filePath && e.category === 'file_operation') files.add(e.filePath);
    if (e.category === 'verification' && e.command) verification.add(e.command);
  }

  return {
    eventCount: events.length,
    userPrompts,
    assistantMessages,
    toolCalls,
    failedToolResults,
    toolsUsed: [...toolCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    commands: [...commands].sort(),
    files: [...files].sort(),
    verificationCommands: [...verification].sort(),
  };
}
