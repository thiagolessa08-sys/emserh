import type { ExtractedPage } from '@/lib/pdf-native-extractor';

export interface TriageChunkResult {
  documentos_encontrados: Array<{ pagina: number; tipo_documento: string }>;
}

export interface TriageResult {
  relevantPages: number[];
  pageTypes: Record<number, string>;
}

/** Divide as páginas em blocos sequenciais de no máximo `size` páginas. */
export function chunkPages(pages: ExtractedPage[], size: number): ExtractedPage[][] {
  const chunks: ExtractedPage[][] = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

/** Une os resultados dos blocos: deduplica páginas válidas e ordena. */
export function aggregateTriage(results: TriageChunkResult[]): TriageResult {
  const pageTypes: Record<number, string> = {};
  const set = new Set<number>();
  for (const r of results) {
    for (const doc of r.documentos_encontrados ?? []) {
      if (Number.isInteger(doc.pagina) && doc.pagina > 0) {
        set.add(doc.pagina);
        if (!pageTypes[doc.pagina]) pageTypes[doc.pagina] = doc.tipo_documento;
      }
    }
  }
  return { relevantPages: [...set].sort((a, b) => a - b), pageTypes };
}
