// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateConformityReport } from '@/lib/report-generator';
import { extractNative } from '@/lib/pdf-native-extractor';
import type { AnalysisResult } from '@/lib/types';

const ANALYSIS: AnalysisResult = {
  identificacao_contrato: {
    credor: 'Empresa Teste Ltda',
    cnpj: '00.000.000/0001-00',
    contrato_numero: '001/2025',
    objeto: 'Prestação de serviços médicos',
    periodo_referencia: 'Outubro/2025',
    processo_sei: '00001.000001/2025-00',
    valor_total: 'R$ 10.000,00',
  },
  regularidade_fiscal_trabalhista: Array.from({ length: 7 }, (_, i) => ({
    item: i + 1,
    descricao: `Regularidade item ${i + 1}`,
    status: 'CONFORME' as const,
    motivo: null,
    documento_verificador: 'CND',
    citacao: 'citação exemplo',
    pagina_estimada: 1,
    observacoes: '',
    sugestao_correcao: null,
    data_validade: '31/12/2025',
  })),
  instrucao_processual: Array.from({ length: 8 }, (_, i) => ({
    item: i + 1,
    descricao: `Instrução item ${i + 1}`,
    status: i === 3 ? ('NAO_CONFORME' as const) : ('CONFORME' as const),
    motivo: i === 3 ? 'Documento ausente' : null,
    documento_verificador: 'NF',
    citacao: 'citação exemplo',
    pagina_estimada: 2,
    observacoes: '',
    sugestao_correcao: i === 3 ? 'Incluir comprovante de recolhimento' : null,
  })),
  conclusao: {
    decisao_geral: 'NAO_CONFORME',
    resumo: 'Um item não conforme identificado.',
    total_itens_conformes: 14,
    total_itens_nao_conformes: 1,
    total_itens_atencao: 0,
    lista_pendencias: ['Item 4 de instrução processual ausente'],
  },
};

describe('generateConformityReport', () => {
  it('retorna um Buffer de PDF válido', async () => {
    const buffer = await generateConformityReport(ANALYSIS);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDFs começam com %PDF
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
  }, 30000);

  it('inclui dados do credor no texto extraído do PDF gerado', async () => {
    const buffer = await generateConformityReport(ANALYSIS);
    const { pages } = await extractNative(buffer);
    const allText = pages.map((p) => p.text).join(' ');
    expect(allText).toContain('Empresa Teste Ltda');
  }, 30000);
});
