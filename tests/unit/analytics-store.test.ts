import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { incrementCount, getAnalytics, resetAnalyticsCache } from '@/lib/analytics-store';

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

describe('analytics-store', () => {
  it('acumula por usuário e data', async () => {
    await incrementCount('joao', '2026-05-28');
    await incrementCount('joao', '2026-05-28');
    await incrementCount('maria', '2026-05-28');
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(2);
    expect(a['2026-05-28'].maria).toBe(1);
  });

  it('serializa incrementos concorrentes sem perder contagem', async () => {
    await Promise.all([
      incrementCount('joao', '2026-05-28'),
      incrementCount('joao', '2026-05-28'),
      incrementCount('joao', '2026-05-28'),
    ]);
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(3);
  });

  it('persiste entre leituras (resetando cache)', async () => {
    await incrementCount('joao', '2026-05-28');
    resetAnalyticsCache();
    const a = await getAnalytics();
    expect(a['2026-05-28'].joao).toBe(1);
  });
});
