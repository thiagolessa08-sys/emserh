import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES } from '@/lib/default-rules';
import { getSegmentChecklist } from '@/lib/segment-rules';

describe('DEFAULT_RULES', () => {
  it('contém todas as combinações válidas de segmento × modalidade', () => {
    expect(Object.keys(DEFAULT_RULES).sort()).toEqual([
      'cessao_mao_obra', 'engenharia', 'fornecedor', 'locacao_pf',
      'locacao_pj', 'monopolio', 'servicos_medicos',
    ]);
    expect(Object.keys(DEFAULT_RULES.fornecedor).sort()).toEqual(['contrato', 'indenizatorio']);
    expect(Object.keys(DEFAULT_RULES.engenharia)).toEqual(['contrato']);
  });

  it('fornecedor/contrato tem itens de regularidade e instrução', () => {
    const c = DEFAULT_RULES.fornecedor.contrato;
    expect(c.regularidade.length).toBeGreaterThan(0);
    expect(c.instrucao.length).toBeGreaterThan(0);
    expect(c.regularidade[0]).toHaveProperty('descricao');
    expect(c.regularidade[0]).toHaveProperty('detalhe');
  });

  it('getSegmentChecklist resolve do store e faz fallback ao default', () => {
    const custom = { regularidade: [{ descricao: 'X', detalhe: 'Y' }], instrucao: [] };
    const store = { fornecedor: { contrato: custom } };
    expect(getSegmentChecklist(store, 'fornecedor', 'contrato')).toEqual(custom);
    // combinação ausente no store → cai no DEFAULT_RULES
    expect(getSegmentChecklist(store, 'engenharia', 'contrato'))
      .toEqual(DEFAULT_RULES.engenharia.contrato);
  });
});
