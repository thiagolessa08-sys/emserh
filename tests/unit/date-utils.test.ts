import { describe, it, expect } from 'vitest';
import { parseBrazilianDate, validityStatus } from '@/lib/date-utils';

describe('parseBrazilianDate', () => {
  it('aceita DD/MM/YYYY', () => {
    expect(parseBrazilianDate('11/07/2025')?.toISOString()).toBe('2025-07-11T00:00:00.000Z');
  });
  it('aceita DD-MM-YYYY', () => {
    expect(parseBrazilianDate('11-07-2025')?.toISOString()).toBe('2025-07-11T00:00:00.000Z');
  });
  it('aceita DD/MM/YY (assume 20XX)', () => {
    expect(parseBrazilianDate('11/07/25')?.toISOString()).toBe('2025-07-11T00:00:00.000Z');
  });
  it('retorna null para entrada inválida', () => {
    expect(parseBrazilianDate('xyz')).toBeNull();
  });
});

describe('validityStatus', () => {
  const today = new Date('2026-05-20T00:00:00.000Z');
  it('vencida → NAO_CONFORME', () => {
    expect(validityStatus(new Date('2026-05-19'), today)).toBe('NAO_CONFORME');
  });
  it('vence hoje → ATENCAO', () => {
    expect(validityStatus(new Date('2026-05-20'), today)).toBe('ATENCAO');
  });
  it('vence em 10 dias → ATENCAO', () => {
    expect(validityStatus(new Date('2026-05-30'), today)).toBe('ATENCAO');
  });
  it('vence em 30 dias → CONFORME', () => {
    expect(validityStatus(new Date('2026-06-19'), today)).toBe('CONFORME');
  });
});
