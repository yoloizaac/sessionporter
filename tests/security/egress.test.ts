import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';
import { exportSession } from '../../src/core/engine.js';
import { useFixtureSources, tempExportRoot, testConfig, CLAUDE_SESSION_ID, CLAUDE_CWD } from '../helpers.js';

describe('network isolation', () => {
  it('runs a full export and a manual import with zero network calls', async () => {
    useFixtureSources();
    const httpSpy = vi.spyOn(http, 'request');
    const httpsSpy = vi.spyOn(https, 'request');
    const netSpy = vi.spyOn(net, 'connect');
    const dnsSpy = vi.spyOn(dns, 'lookup');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const out = await tempExportRoot();
      const r = await exportSession({
        source: 'claude-code',
        sessionId: CLAUDE_SESSION_ID,
        cwd: CLAUDE_CWD,
        mode: 'sanitized',
        config: testConfig(),
        exportRoot: out,
        exportedAt: '2026-06-20T00:00:00.000Z',
        makeZip: true,
        includeRaw: false,
        allowSecrets: false,
      });
      expect(r.validation.ok).toBe(true);

      expect(httpSpy).not.toHaveBeenCalled();
      expect(httpsSpy).not.toHaveBeenCalled();
      expect(netSpy).not.toHaveBeenCalled();
      expect(dnsSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      httpSpy.mockRestore();
      httpsSpy.mockRestore();
      netSpy.mockRestore();
      dnsSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });
});
