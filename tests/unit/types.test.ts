import { describe, it, expect } from 'vitest';
import {
  AnalysisResultSchema,
  ChecklistItemStatus,
  type AnalysisResult,
} from '@/lib/types';

describe('AnalysisResultSchema', () => {
  it('valida resultado completo', () => {
    const valid: AnalysisResult = {
      identificacao_contrato: {
        credor: 'IMEC',
        cnpj: '33.031.719/0001-49',
        contrato_numero: '420/2021',
        objeto: 'Cirurgia Geral',
        periodo_referencia: 'Abril/2025',
        processo_sei: '202511021518468',
        valor_total: 'R$ 78.307,20',
      },
      regularidade_fiscal_trabalhista: Array.from({ length: 7 }, (_, i) => ({
        item: i + 1,
        descricao: `Item ${i + 1}`,
        status: 'CONFORME' as const,
        motivo: 'OK',
        data_validade: null,
        documento_verificador: '7871321',
        citacao: 'trecho',
        pagina_estimada: 1,
        observacoes: '',
        sugestao_correcao: null,
      })),
      instrucao_processual: Array.from({ length: 8 }, (_, i) => ({
        item: i + 1,
        descricao: `Item ${i + 1}`,
        status: 'CONFORME' as const,
        motivo: 'OK',
        documento_verificador: '7871321',
        citacao: 'trecho',
        pagina_estimada: 1,
        observacoes: '',
        sugestao_correcao: null,
      })),
      conclusao: {
        decisao_geral: 'CONFORME',
        resumo: 'Tudo certo',
        total_itens_conformes: 15,
        total_itens_nao_conformes: 0,
        total_itens_atencao: 0,
        lista_pendencias: [],
      },
    };
    expect(AnalysisResultSchema.parse(valid)).toEqual(valid);
  });

  it('rejeita status inválido', () => {
    expect(() => ChecklistItemStatus.parse('TALVEZ')).toThrow();
  });

  it('exige exatamente 7 itens de regularidade', () => {
    expect(() =>
      AnalysisResultSchema.parse({
        identificacao_contrato: {
          credor: '',
          cnpj: '',
          contrato_numero: '',
          objeto: '',
          periodo_referencia: '',
          processo_sei: '',
          valor_total: '',
        },
        regularidade_fiscal_trabalhista: [],
        instrucao_processual: [],
        conclusao: {
          decisao_geral: 'CONFORME',
          resumo: '',
          total_itens_conformes: 0,
          total_itens_nao_conformes: 0,
          total_itens_atencao: 0,
          lista_pendencias: [],
        },
      }),
    ).toThrow();
  });
});
