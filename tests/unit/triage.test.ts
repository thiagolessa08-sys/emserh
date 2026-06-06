import { describe, it, expect } from 'vitest';
import { chunkPages, aggregateTriage } from '@/lib/triage';
import type { ExtractedPage } from '@/lib/pdf-native-extractor';

function makePage(pageNumber: number): ExtractedPage {
  return { pageNumber, text: `texto ${pageNumber}`, isScanned: false, textItems: [] };
}

describe('chunkPages', () => {
  it('divide 100 páginas em blocos de 40', () => {
    const pages = Array.from({ length: 100 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 20]);
  });

  it('mantém tudo em um bloco quando menor que o tamanho', () => {
    const pages = Array.from({ length: 10 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
  });

  it('preserva os números de página originais', () => {
    const pages = Array.from({ length: 50 }, (_, i) => makePage(i + 1));
    const chunks = chunkPages(pages, 40);
    expect(chunks[1][0].pageNumber).toBe(41);
  });
});

describe('aggregateTriage', () => {
  it('une e deduplica páginas de múltiplos blocos, ordenadas', () => {
    const result = aggregateTriage([
      { documentos_encontrados: [{ pagina: 5, tipo_documento: 'CND' }, { pagina: 2, tipo_documento: 'NF' }] },
      { documentos_encontrados: [{ pagina: 5, tipo_documento: 'CND' }, { pagina: 9, tipo_documento: 'Contrato' }] },
    ]);
    expect(result.relevantPages).toEqual([2, 5, 9]);
  });

  it('ignora páginas inválidas (<= 0 ou não inteiras)', () => {
    const result = aggregateTriage([
      { documentos_encontrados: [{ pagina: 0, tipo_documento: 'x' }, { pagina: -1, tipo_documento: 'y' }, { pagina: 3, tipo_documento: 'z' }] },
    ]);
    expect(result.relevantPages).toEqual([3]);
  });

  it('retorna lista vazia quando não há documentos', () => {
    const result = aggregateTriage([{ documentos_encontrados: [] }]);
    expect(result.relevantPages).toEqual([]);
  });
});
