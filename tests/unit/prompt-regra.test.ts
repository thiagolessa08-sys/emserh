import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@/lib/prompt';
import { DEFAULT_RULES } from '@/lib/default-rules';

const checklist = DEFAULT_RULES.fornecedor.contrato;

describe('buildSystemPrompt com regra extra', () => {
  it('sem regra extra não inclui a seção adicional', () => {
    const p = buildSystemPrompt(checklist, 'fornecedor', 'contrato');
    expect(p).not.toContain('REGRA ADICIONAL');
  });
  it('com regra extra inclui a seção e o texto', () => {
    const p = buildSystemPrompt(checklist, 'fornecedor', 'contrato', 'verificar autorização do gestor');
    expect(p).toContain('REGRA ADICIONAL');
    expect(p).toContain('verificar autorização do gestor');
  });
});
