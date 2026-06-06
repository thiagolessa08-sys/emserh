import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';

describe('buildSystemPrompt', () => {
  it('inclui o segmento e a modalidade selecionados', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('Fornecedor');
    expect(prompt).toContain('Contrato');
  });

  it('inclui a data de hoje como referência de validade', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('DATA DE HOJE');
  });

  it('contém os itens de regularidade do segmento fornecedor', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('Cartão CNPJ');
    expect(prompt).toContain('Certificado de Regularidade do FGTS');
    expect(prompt).toContain('Cadastro Estadual de Inadimplentes');
  });

  it('contém itens de instrução processual', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('Nota Fiscal');
    expect(prompt).toContain('Manifestação da Autoridade Competente');
  });

  it('contém referências legais', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('13.303');
    expect(prompt).toContain('439');
    expect(prompt).toContain('279');
    expect(prompt).toContain('RILC');
  });

  it('contém regras de variantes conhecidas', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('Certidão Positiva com Efeitos de Negativa');
    expect(prompt).toContain('JUNTADA GCIF');
  });

  it('contém os status de conformidade', () => {
    const prompt = buildSystemPrompt('fornecedor', 'contrato');
    expect(prompt).toContain('CONFORME');
    expect(prompt).toContain('NAO_CONFORME');
    expect(prompt).toContain('ATENCAO');
  });

  it('ajusta o checklist conforme o segmento (CNDT só em cessão de mão de obra)', () => {
    const fornecedor = buildSystemPrompt('fornecedor', 'contrato');
    const cessao = buildSystemPrompt('cessao_mao_obra', 'contrato');
    expect(fornecedor).not.toContain('CNDT');
    expect(cessao).toContain('CNDT');
  });
});

describe('buildUserPrompt', () => {
  it('incorpora o texto extraído do PDF', () => {
    const text = '=== PÁGINA 1 ===\nConteúdo do processo';
    const prompt = buildUserPrompt(text, 'fornecedor', 'contrato');
    expect(prompt).toContain(text);
  });

  it('instrui a análise via tool call submit_analysis', () => {
    const prompt = buildUserPrompt('texto qualquer', 'fornecedor', 'contrato');
    expect(prompt).toContain('submit_analysis');
  });
});
