/**
 * Testes E2E gold set — requerem PDFs reais e chaves de API.
 * Executar com: INTEGRATION=1 npm test -- tests/integration/gold-set.test.ts
 *
 * Os PDFs de fixture estão gitignored (LGPD).
 * Copie os PDFs de exemplo para tests/fixtures/pdfs/ antes de rodar.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractPdfHybrid } from '@/lib/pdf-extractor';
import { analyzeWithClaude } from '@/lib/claude-analyzer';

const INTEGRATION = process.env.INTEGRATION === '1';
const FIXTURES_DIR = join(__dirname, '../fixtures/pdfs');

function describeIntegration(name: string, fn: () => void) {
  if (!INTEGRATION) {
    describe.skip(`[INTEGRATION SKIP] ${name}`, fn);
  } else {
    describe(name, fn);
  }
}

function loadFixture(filename: string): Buffer | null {
  const path = join(FIXTURES_DIR, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

describeIntegration('Gold set — extração híbrida', () => {
  const fixture = 'sample-native.pdf';

  it('extrai texto de pelo menos 70% das páginas do sample-native.pdf', async () => {
    const buf = loadFixture(fixture);
    if (!buf) return; // Skip se o arquivo não existir

    const result = await extractPdfHybrid(buf);
    expect(result.totalPages).toBeGreaterThan(0);

    const pagesWithText = result.pages.filter((p) => p.text.length > 50);
    const coverage = pagesWithText.length / result.totalPages;
    expect(coverage).toBeGreaterThanOrEqual(0.7);
  }, 120000);
});

describeIntegration('Gold set — análise Claude', () => {
  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');
    if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY não configurada');
  });

  it('analisa sample-native.pdf e retorna resultado válido com 15 itens', async () => {
    const buf = loadFixture('sample-native.pdf');
    if (!buf) return;

    const extracted = await extractPdfHybrid(buf);
    expect(extracted.consolidatedText.length).toBeGreaterThan(100);

    const result = await analyzeWithClaude(extracted.consolidatedText);

    // Estrutura
    expect(result.regularidade_fiscal_trabalhista).toHaveLength(7);
    expect(result.instrucao_processual).toHaveLength(8);

    // Todos os status devem ser válidos
    const allItems = [
      ...result.regularidade_fiscal_trabalhista,
      ...result.instrucao_processual,
    ];
    for (const item of allItems) {
      expect(['CONFORME', 'NAO_CONFORME', 'ATENCAO']).toContain(item.status);
    }

    // Contagens devem somar 15
    const { total_itens_conformes, total_itens_nao_conformes, total_itens_atencao } =
      result.conclusao;
    expect(total_itens_conformes + total_itens_nao_conformes + total_itens_atencao).toBe(15);

    // Conclusão geral deve ser um dos valores válidos
    expect(['CONFORME', 'NAO_CONFORME', 'PENDENTE_AJUSTES']).toContain(
      result.conclusao.decisao_geral,
    );

    // Identificação do contrato deve ter os campos principais
    expect(result.identificacao_contrato.credor).toBeTruthy();
    expect(result.identificacao_contrato.cnpj).toBeTruthy();
  }, 300000); // 5 min timeout para OCR + Claude
});
