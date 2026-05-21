import { describe, it, expect } from 'vitest';
import { findCitationPage, type PageIndex } from '@/lib/citation-matcher';

const PAGES: PageIndex[] = [
  { pageNumber: 1, text: 'Certidão Negativa de Débitos INSS emitida pela Receita Federal validade 31/12/2025' },
  { pageNumber: 2, text: 'Nota Fiscal número 000123 valor R$ 5.000,00 serviços médicos outubro 2025' },
  { pageNumber: 3, text: 'Boletim de Medição referente ao contrato 001/2025 competência outubro' },
  { pageNumber: 5, text: 'JUNTADA GCIF processo encaminhado para pagamento autorizado' },
];

describe('findCitationPage', () => {
  it('encontra página exata quando citação está presente', () => {
    const page = findCitationPage('Certidão Negativa de Débitos INSS', PAGES);
    expect(page).toBe(1);
  });

  it('encontra página por fuzzy match com termos parciais', () => {
    const page = findCitationPage('Nota Fiscal 000123 serviços médicos', PAGES);
    expect(page).toBe(2);
  });

  it('encontra GCIF pela variante JUNTADA GCIF', () => {
    const page = findCitationPage('JUNTADA GCIF pagamento autorizado', PAGES);
    expect(page).toBe(5);
  });

  it('retorna 1 quando não encontra nenhuma correspondência', () => {
    const page = findCitationPage('documento inexistente xyzabc123', PAGES);
    expect(page).toBe(1);
  });

  it('retorna 1 quando pages está vazio', () => {
    const page = findCitationPage('qualquer coisa', []);
    expect(page).toBe(1);
  });
});
