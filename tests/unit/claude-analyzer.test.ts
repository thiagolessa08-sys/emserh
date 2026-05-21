import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWithClaude } from '@/lib/claude-analyzer';

const VALID_RESULT = {
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
    descricao: `Item regularidade ${i + 1}`,
    status: 'CONFORME',
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
    descricao: `Item instrução ${i + 1}`,
    status: 'CONFORME',
    motivo: null,
    documento_verificador: 'NF',
    citacao: 'citação exemplo',
    pagina_estimada: 2,
    observacoes: '',
    sugestao_correcao: null,
  })),
  conclusao: {
    decisao_geral: 'CONFORME',
    resumo: 'Processo em conformidade.',
    total_itens_conformes: 15,
    total_itens_nao_conformes: 0,
    total_itens_atencao: 0,
    lista_pendencias: [],
  },
};

function makeApiResponse(result: unknown) {
  return {
    ok: true,
    json: async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'submit_analysis',
          input: result,
        },
      ],
    }),
  };
}

describe('analyzeWithClaude', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('retorna AnalysisResult validado quando Claude responde corretamente', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeApiResponse(VALID_RESULT));
    const result = await analyzeWithClaude('texto do processo');
    expect(result.identificacao_contrato.credor).toBe('Empresa Teste Ltda');
    expect(result.regularidade_fiscal_trabalhista).toHaveLength(7);
    expect(result.instrucao_processual).toHaveLength(8);
    expect(result.conclusao.decisao_geral).toBe('CONFORME');
  });

  it('faz retry em erro 529 (overloaded) e retorna sucesso na segunda tentativa', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 529, text: async () => 'overloaded' })
      .mockResolvedValueOnce(makeApiResponse(VALID_RESULT));
    const result = await analyzeWithClaude('texto');
    expect(result.conclusao.decisao_geral).toBe('CONFORME');
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('lança erro após 3 tentativas sem sucesso', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    await expect(analyzeWithClaude('texto')).rejects.toThrow(/500/);
  });

  it('lança erro de validação Zod quando Claude retorna JSON inválido', async () => {
    const invalid = { ...VALID_RESULT, regularidade_fiscal_trabalhista: [] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeApiResponse(invalid));
    await expect(analyzeWithClaude('texto')).rejects.toThrow();
  });

  it('lança erro quando resposta não contém tool_use', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'desculpe' }] }),
    });
    await expect(analyzeWithClaude('texto')).rejects.toThrow(/tool_use/);
  });
});
