import { DEFAULT_RULES, type RulesStore, type SegmentChecklist, type ChecklistItem } from '@/lib/default-rules';
import type { SegmentoId, Modalidade } from '@/lib/types';

export type { RulesStore, SegmentChecklist, ChecklistItem };

/**
 * Busca o checklist de uma combinação no store. Fallback em cascata:
 * store → DEFAULT_RULES → primeira modalidade do segmento → vazio.
 */
export function getSegmentChecklist(
  store: RulesStore,
  segmento: SegmentoId,
  modalidade: Modalidade,
): SegmentChecklist {
  return (
    store[segmento]?.[modalidade] ??
    DEFAULT_RULES[segmento]?.[modalidade] ??
    Object.values(DEFAULT_RULES[segmento] ?? {})[0] ??
    { regularidade: [], instrucao: [] }
  );
}

export function getSegmentLabel(segmento: SegmentoId): string {
  const found = [
    { id: 'fornecedor', label: 'Fornecedor (materiais / serviços)' },
    { id: 'cessao_mao_obra', label: 'Cessão de Mão de Obra (terceirização)' },
    { id: 'engenharia', label: 'Serviços de Engenharia' },
    { id: 'servicos_medicos', label: 'Serviços Médicos' },
    { id: 'locacao_pf', label: 'Locação de Imóvel — Pessoa Física' },
    { id: 'locacao_pj', label: 'Locação de Imóvel — Pessoa Jurídica' },
    { id: 'monopolio', label: 'Monopólio / Locação em geral' },
  ].find((s) => s.id === segmento);
  return found?.label ?? segmento;
}
