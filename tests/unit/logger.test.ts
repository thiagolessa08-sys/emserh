import { describe, it, expect } from 'vitest';
import { createLogger, sanitize } from '@/lib/logger';

describe('logger', () => {
  it('cria logger com base context', () => {
    const log = createLogger({ component: 'test' });
    expect(typeof log.info).toBe('function');
  });

  it('remove campos sensíveis (paciente, cpf, cns)', () => {
    const dirty = {
      analysis_id: 'abc',
      paciente: 'João Silva',
      cpf: '111.222.333-44',
      cns: '700123456789012',
      duracao_ms: 1234,
    };
    const clean = sanitize(dirty);
    expect(clean).toEqual({ analysis_id: 'abc', duracao_ms: 1234 });
  });
});
