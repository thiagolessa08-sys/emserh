import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_RULES, type RulesStore, type SegmentChecklist } from '@/lib/default-rules';
import { SEGMENTOS, type SegmentoId, type Modalidade } from '@/lib/types';
import { logger } from '@/lib/logger';

export const ChecklistItemSchema = z.object({
  descricao: z.string().min(1),
  detalhe: z.string(),
});

export const SegmentChecklistSchema = z.object({
  regularidade: z.array(ChecklistItemSchema),
  instrucao: z.array(ChecklistItemSchema),
});

export const CombinationPayloadSchema = z.object({
  segmento: z.enum(['fornecedor', 'cessao_mao_obra', 'engenharia', 'servicos_medicos', 'locacao_pf', 'locacao_pj', 'monopolio']),
  modalidade: z.enum(['contrato', 'indenizatorio']),
  checklist: SegmentChecklistSchema,
});

function getStorePath(): string {
  return process.env.RULES_STORE_PATH ?? path.join(process.cwd(), 'data', 'rules.json');
}

/**
 * Indica se a persistência está configurada para sobreviver a deploys.
 * Sem RULES_STORE_PATH apontando para um volume, as edições vão para o
 * filesystem efêmero do container e somem no próximo deploy.
 */
export function isPersistenceConfigured(): boolean {
  return Boolean(process.env.RULES_STORE_PATH);
}

let cache: RulesStore | null = null;

/** Apenas para testes — limpa o cache em memória. */
export function resetRulesCache(): void {
  cache = null;
}

/** Mescla o conteúdo lido do arquivo com os defaults: combinações ausentes
 *  ou inválidas herdam DEFAULT_RULES. Função pura. */
export function mergeWithDefaults(parsed: unknown): RulesStore {
  const result: RulesStore = {};
  for (const seg of SEGMENTOS) {
    result[seg.id] = {};
    for (const mod of seg.modalidades) {
      const candidate = (parsed as Record<string, Record<string, unknown>> | null)?.[seg.id]?.[mod];
      const check = SegmentChecklistSchema.safeParse(candidate);
      result[seg.id][mod] = check.success ? check.data : DEFAULT_RULES[seg.id][mod];
    }
  }
  return result;
}

async function atomicWrite(store: RulesStore): Promise<void> {
  const p = getStorePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmp, p);
}

/** Carrega o store (cacheado). Seed quando ausente; fallback aos defaults
 *  quando ausente ou corrompido — a análise nunca quebra. */
export async function getRulesStore(): Promise<RulesStore> {
  if (cache) return cache;
  const p = getStorePath();
  try {
    const raw = await fs.readFile(p, 'utf-8');
    cache = mergeWithDefaults(JSON.parse(raw));
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'rules_store_seed_or_fallback');
    cache = mergeWithDefaults({});
    try {
      await atomicWrite(cache);
    } catch (writeErr) {
      logger.error({ err: writeErr instanceof Error ? writeErr.message : String(writeErr) }, 'rules_store_seed_write_failed');
    }
  }
  return cache;
}

/** Salva uma combinação e atualiza o cache. */
export async function saveCombination(
  segmento: SegmentoId,
  modalidade: Modalidade,
  checklist: SegmentChecklist,
): Promise<void> {
  const store = await getRulesStore();
  const next: RulesStore = structuredClone(store);
  next[segmento] = { ...(next[segmento] ?? {}), [modalidade]: checklist };
  await atomicWrite(next);
  cache = next;
}
