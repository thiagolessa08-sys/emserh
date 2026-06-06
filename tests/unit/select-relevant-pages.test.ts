import { describe, it, expect } from 'vitest';
import { selectRelevantPages } from '@/lib/claude-analyzer';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

function makePage(pageNumber: number, text = `texto da pagina ${pageNumber}`): ExtractedPage {
  return { pageNumber, text, isScanned: false, textItems: [] };
}

const pages = Array.from({ length: 20 }, (_, i) => makePage(i + 1));

describe('selectRelevantPages', () => {
  it('sempre inclui as páginas de capa (1-3) além das relevantes', () => {
    const text = selectRelevantPages(pages, [10, 15], 1_000_000);
    expect(text).toContain('=== PÁGINA 1 ===');
    expect(text).toContain('=== PÁGINA 2 ===');
    expect(text).toContain('=== PÁGINA 3 ===');
    expect(text).toContain('=== PÁGINA 10 ===');
    expect(text).toContain('=== PÁGINA 15 ===');
    expect(text).not.toContain('=== PÁGINA 11 ===');
  });

  it('mantém a ordem crescente de páginas', () => {
    const text = selectRelevantPages(pages, [15, 10], 1_000_000);
    expect(text.indexOf('PÁGINA 10')).toBeLessThan(text.indexOf('PÁGINA 15'));
  });

  it('faz fallback para todas as páginas quando não há relevantes', () => {
    const text = selectRelevantPages(pages, [], 1_000_000);
    expect(text).toContain('=== PÁGINA 20 ===');
  });

  it('para de incluir páginas quando o próximo bloco excederia o limite', () => {
    // Cada bloco tem ~35 chars ("=== PÁGINA N ===\ntexto da pagina N").
    // Com maxChars=50 só cabe 1 página (35 chars); a segunda empurraria para 72.
    const text = selectRelevantPages(pages, [], 50);
    expect(text).toContain('=== PÁGINA 1 ===');
    expect(text).not.toContain('=== PÁGINA 2 ===');
    expect(text.length).toBeLessThanOrEqual(50);
  });
});
