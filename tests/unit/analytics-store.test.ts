import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { recordAnalysis, getEvents, resetAnalyticsCache } from '@/lib/analytics-store';

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analytics-'));
  process.env.ANALYTICS_STORE_PATH = path.join(tmpDir, 'analytics.json');
  resetAnalyticsCache();
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.ANALYTICS_STORE_PATH;
});

describe('analytics-store (eventos)', () => {
  it('registra eventos com usuário, conformidade e tempo', async () => {
    await recordAnalysis({ username: 'joao', ts: '2026-05-28T10:00:00.000Z', conforme: true, durationMs: 5000 });
    await recordAnalysis({ username: 'joao', ts: '2026-05-28T11:00:00.000Z', conforme: false, durationMs: 7000 });
    const ev = await getEvents();
    expect(ev).toHaveLength(2);
    expect(ev[0].username).toBe('joao');
    expect(ev[0].conforme).toBe(true);
    expect(ev[1].durationMs).toBe(7000);
  });

  it('serializa gravações concorrentes sem perder eventos', async () => {
    await Promise.all([
      recordAnalysis({ username: 'a', ts: '2026-05-28T10:00:00.000Z', conforme: true, durationMs: 1000 }),
      recordAnalysis({ username: 'b', ts: '2026-05-28T10:00:01.000Z', conforme: true, durationMs: 1000 }),
      recordAnalysis({ username: 'c', ts: '2026-05-28T10:00:02.000Z', conforme: false, durationMs: 1000 }),
    ]);
    expect(await getEvents()).toHaveLength(3);
  });

  it('persiste entre leituras (resetando cache)', async () => {
    await recordAnalysis({ username: 'joao', ts: '2026-05-28T10:00:00.000Z', conforme: true, durationMs: 1000 });
    resetAnalyticsCache();
    expect(await getEvents()).toHaveLength(1);
  });
});
