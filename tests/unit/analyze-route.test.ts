// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/pdf-extractor', () => ({
  extractPdfHybrid: vi.fn(async () => ({
    pages: [{ pageNumber: 1, text: 'texto extraído', isScanned: false, textItems: [] }],
    totalPages: 1,
    scannedPageCount: 0,
    consolidatedText: '=== PÁGINA 1 ===\ntexto extraído',
  })),
}));

const MOCK_RESULT = {
  identificacao_contrato: {
    credor: 'Empresa Teste Ltda',
    cnpj: '00.000.000/0001-00',
    contrato_numero: '001/2025',
    objeto: 'Serviços',
    periodo_referencia: 'Out/2025',
    processo_sei: '0001/2025',
    valor_total: 'R$ 1.000,00',
  },
  regularidade_fiscal_trabalhista: Array.from({ length: 7 }, (_, i) => ({
    item: i + 1,
    descricao: `Reg ${i + 1}`,
    status: 'CONFORME',
    motivo: null,
    documento_verificador: 'CND',
    citacao: 'cit',
    pagina_estimada: 1,
    observacoes: '',
    sugestao_correcao: null,
    data_validade: null,
  })),
  instrucao_processual: Array.from({ length: 8 }, (_, i) => ({
    item: i + 1,
    descricao: `Inst ${i + 1}`,
    status: 'CONFORME',
    motivo: null,
    documento_verificador: 'NF',
    citacao: 'cit',
    pagina_estimada: 1,
    observacoes: '',
    sugestao_correcao: null,
  })),
  conclusao: {
    decisao_geral: 'CONFORME',
    resumo: 'OK',
    total_itens_conformes: 15,
    total_itens_nao_conformes: 0,
    total_itens_atencao: 0,
    lista_pendencias: [],
  },
};

vi.mock('@/lib/claude-analyzer', () => ({
  analyzeProcess: vi.fn(async () => ({ analysis: MOCK_RESULT, focusedText: 'texto usado na analise' })),
}));

vi.mock('@/lib/report-generator', () => ({
  generateConformityReport: vi.fn(async () => Buffer.from('%PDF-1.4 fake')),
}));

vi.mock('@/lib/pdf-annotator', () => ({
  annotatePdf: vi.fn(async (buf: Buffer) => buf),
}));

vi.mock('@/lib/citation-matcher', () => ({
  findCitationPage: vi.fn(() => 1),
}));

async function makeRequest(files: Array<{ name: string; content: Buffer }>): Promise<Request> {
  const form = new FormData();
  for (const f of files) {
    form.append('files', new Blob([new Uint8Array(f.content)], { type: 'application/pdf' }), f.name);
  }
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.MISTRAL_API_KEY = 'test-key';
  });

  it('retorna 200 com resultado da análise (stream SSE)', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const req = await makeRequest([{ name: 'processo.pdf', content: Buffer.from('fake-pdf') }]);
    const res = await POST(req);
    expect(res.status).toBe(200);

    // A rota responde via Server-Sent Events: cada evento é uma linha "data: {...}"
    const text = await res.text();
    const events = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => JSON.parse(l.slice(6)));

    const resultEvent = events.find((e) => e.type === 'result');
    expect(resultEvent).toBeTruthy();
    expect(resultEvent.results).toHaveLength(1);
    expect(resultEvent.results[0].filename).toBe('processo.pdf');
    expect(resultEvent.results[0].analysis.conclusao.decisao_geral).toBe('CONFORME');
    expect(resultEvent.results[0].reportPdf).toBeTruthy();
  });

  it('retorna 400 quando nenhum arquivo enviado', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const form = new FormData();
    const req = new Request('http://localhost/api/analyze', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando arquivo não é PDF', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    const form = new FormData();
    form.append('files', new Blob(['hello'], { type: 'text/plain' }), 'arquivo.txt');
    const req = new Request('http://localhost/api/analyze', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
