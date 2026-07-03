import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@/lib/logger';

export interface AnalyticsEvent {
  username: string;   // email/login do usuário
  ts: string;         // ISO timestamp
  conforme: boolean;  // decisao_geral === 'CONFORME'
  durationMs: number; // tempo de processamento da análise
}

interface AnalyticsStore {
  events: AnalyticsEvent[];
}

function getAnalyticsPath(): string {
  if (process.env.ANALYTICS_STORE_PATH) return process.env.ANALYTICS_STORE_PATH;
  const base = process.env.RULES_STORE_PATH
    ? path.dirname(process.env.RULES_STORE_PATH)
    : path.join(process.cwd(), 'data');
  return path.join(base, 'analytics.json');
}

let cache: AnalyticsStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function resetAnalyticsCache(): void {
  cache = null;
  writeQueue = Promise.resolve();
}

async function read(): Promise<AnalyticsStore> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(getAnalyticsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    cache = parsed && Array.isArray(parsed.events) ? (parsed as AnalyticsStore) : { events: [] };
  } catch {
    cache = { events: [] };
  }
  return cache;
}

async function write(data: AnalyticsStore): Promise<void> {
  const p = getAnalyticsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function getEvents(): Promise<AnalyticsEvent[]> {
  return (await read()).events;
}

/** Registra um evento de análise. Serializado para evitar corrida. */
export function recordAnalysis(ev: AnalyticsEvent): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      const current = await read();
      await write({ events: [...current.events, ev] });
    })
    .catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'analytics_record_failed');
    });
  return writeQueue;
}
