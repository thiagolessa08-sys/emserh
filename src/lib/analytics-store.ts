import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@/lib/logger';

export type Analytics = { [data: string]: { [username: string]: number } };

function getAnalyticsPath(): string {
  if (process.env.ANALYTICS_STORE_PATH) return process.env.ANALYTICS_STORE_PATH;
  const base = process.env.RULES_STORE_PATH
    ? path.dirname(process.env.RULES_STORE_PATH)
    : path.join(process.cwd(), 'data');
  return path.join(base, 'analytics.json');
}

let cache: Analytics | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function resetAnalyticsCache(): void {
  cache = null;
  writeQueue = Promise.resolve();
}

async function read(): Promise<Analytics> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(getAnalyticsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    cache = parsed && typeof parsed === 'object' ? (parsed as Analytics) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function write(data: Analytics): Promise<void> {
  const p = getAnalyticsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function getAnalytics(): Promise<Analytics> {
  return read();
}

/** Incrementa o contador do usuário na data. Serializado para evitar corrida. */
export function incrementCount(username: string, data: string, by = 1): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      const current = await read();
      const next: Analytics = structuredClone(current);
      next[data] = next[data] ?? {};
      next[data][username] = (next[data][username] ?? 0) + by;
      await write(next);
    })
    .catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'analytics_increment_failed');
    });
  return writeQueue;
}
