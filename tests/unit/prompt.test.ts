import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';

describe('buildSystemPrompt', () => {
  it('contém os 7 itens de regularidade fiscal/trabalhista', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Regularidade com a Seguridade Social');
    expect(prompt).toContain('Regularidade com o FGTS');
    expect(prompt).toContain('Regularidade Federal');
    expect(prompt).toContain('Regularidade Estadual');
    expect(prompt).toContain('Regularidade Municipal');
    expect(prompt).toContain('Regularidade Trabalhista');
    expect(prompt).toContain('Regularidade Fazendária Estadual');
  });

  it('contém os 8 itens de instrução processual', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Nota Fiscal');
    expect(prompt).toContain('Boletim de Medição');
    expect(prompt).toContain('Ateste');
    expect(prompt).toContain('GCIF');
    expect(prompt).toContain('Contrato');
    expect(prompt).toContain('Empenho');
  });

  it('contém referências legais', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('13.303');
    expect(prompt).toContain('439');
    expect(prompt).toContain('279');
    expect(prompt).toContain('RILC');
  });

  it('contém regras de variantes conhecidas', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Certidão Positiva com Efeitos de Negativa');
    expect(prompt).toContain('JUNTADA GCIF');
  });

  it('contém instrução de formato JSON', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('CONFORME');
    expect(prompt).toContain('NAO_CONFORME');
    expect(prompt).toContain('ATENCAO');
  });
});

describe('buildUserPrompt', () => {
  it('incorpora o texto extraído do PDF', () => {
    const text = '=== PÁGINA 1 ===\nConteúdo do processo';
    const prompt = buildUserPrompt(text);
    expect(prompt).toContain(text);
  });

  it('instrui a análise de todos os 15 itens', () => {
    const prompt = buildUserPrompt('texto qualquer');
    expect(prompt).toContain('15');
  });
});
