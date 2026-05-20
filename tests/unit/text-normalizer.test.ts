import { describe, it, expect } from 'vitest';
import { normalizeText } from '@/lib/text-normalizer';

describe('normalizeText', () => {
  it('substitui replacement char por melhor palpite', () => {
    expect(normalizeText('Servi�os M�dicos')).toBe('Serviços Médicos');
  });
  it('preserva texto válido', () => {
    expect(normalizeText('Texto normal acentuado: ção')).toBe('Texto normal acentuado: ção');
  });
  it('remove caracteres de controle exceto \\n e \\t', () => {
    expect(normalizeText('abc\x00def\nghi')).toBe('abcdef\nghi');
  });
  it('colapsa whitespace múltiplo na mesma linha', () => {
    expect(normalizeText('a   b\t\tc')).toBe('a b c');
  });
});
