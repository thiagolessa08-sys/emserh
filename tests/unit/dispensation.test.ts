import { describe, it, expect } from 'vitest';
import { isDispensado, recomputeConclusao, type Dispensa } from '@/lib/dispensation';
import type { AnalysisResult } from '@/lib/types';

function item(n: number, status: 'CONFORME' | 'NAO_CONFORME' | 'ATENCAO') {
  return { item: n, descricao: `d${n}`, status, motivo: null, documento_verificador: null, citacao: '', pagina_estimada: 1, observacoes: '', sugestao_correcao: null };
}
const analysis = {
  identificacao_contrato: { credor: '', cnpj: '', contrato_numero: '', objeto: '', periodo_referencia: '', processo_sei: '', valor_total: '' },
  regularidade_fiscal_trabalhista: [{ ...item(1, 'CONFORME'), data_validade: null }, { ...item(2, 'NAO_CONFORME'), data_validade: null }],
  instrucao_processual: [item(1, 'ATENCAO'), item(2, 'NAO_CONFORME')],
  conclusao: { decisao_geral: 'NAO_CONFORME', resumo: '', total_itens_conformes: 1, total_itens_nao_conformes: 2, total_itens_atencao: 1, lista_pendencias: [] },
} as unknown as AnalysisResult;

describe('isDispensado', () => {
  it('identifica item por seção e número', () => {
    const d: Dispensa[] = [{ secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '2026-07-04T00:00:00Z' }];
    expect(isDispensado(d, 'reg', 2)).toBe(true);
    expect(isDispensado(d, 'inst', 2)).toBe(false);
    expect(isDispensado(d, 'reg', 1)).toBe(false);
  });
});

describe('recomputeConclusao', () => {
  it('sem dispensas mantém os totais e a decisão', () => {
    const r = recomputeConclusao(analysis, []);
    expect(r.naoConformes).toBe(2);
    expect(r.dispensados).toBe(0);
    expect(r.decisao).toBe('NAO_CONFORME');
  });
  it('dispensar 1 de 2 não conformes mantém NAO_CONFORME', () => {
    const r = recomputeConclusao(analysis, [{ secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '' }]);
    expect(r.naoConformes).toBe(1);
    expect(r.dispensados).toBe(1);
    expect(r.decisao).toBe('NAO_CONFORME');
  });
  it('dispensar todos os não conformes vira CONFORME', () => {
    const r = recomputeConclusao(analysis, [
      { secao: 'reg', item: 2, justificativa: 'x', auditorNome: 'A', dataISO: '' },
      { secao: 'inst', item: 2, justificativa: 'y', auditorNome: 'A', dataISO: '' },
    ]);
    expect(r.naoConformes).toBe(0);
    expect(r.dispensados).toBe(2);
    expect(r.decisao).toBe('CONFORME');
  });
});
