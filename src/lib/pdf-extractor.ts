import { extractNative, type ExtractedPage } from '@/lib/pdf-native-extractor';
import { ocrPagesViaMistral } from '@/lib/ocr-mistral';
import { normalizeText } from '@/lib/text-normalizer';
import { logger } from '@/lib/logger';

export interface HybridExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
  scannedPageCount: number;
  consolidatedText: string;
}

export async function extractPdfHybrid(
  pdfBuffer: Buffer,
  onProgress?: (stage: 'extracting' | 'ocr', message: string) => void,
): Promise<HybridExtractionResult> {
  const native = await extractNative(pdfBuffer, (current, total) => {
    onProgress?.('extracting', `Extraindo texto... (pág. ${current}/${total})`);
  });

  const scannedPageNumbers = native.pages.filter((p) => p.isScanned).map((p) => p.pageNumber);
  logger.info(
    { totalPages: native.totalPages, scanned: scannedPageNumbers.length },
    'extraction_started',
  );

  let ocrResults: Record<number, string> = {};
  if (scannedPageNumbers.length > 0) {
    onProgress?.(
      'ocr',
      `Enviando ${scannedPageNumbers.length} pág. escaneada(s) para OCR...`,
    );
    ocrResults = await ocrPagesViaMistral(pdfBuffer, scannedPageNumbers);
    onProgress?.(
      'ocr',
      `OCR concluído: ${scannedPageNumbers.length} pág. processada(s).`,
    );
  }

  const pages = native.pages.map((p) => {
    if (p.isScanned && ocrResults[p.pageNumber]) {
      return { ...p, text: normalizeText(ocrResults[p.pageNumber]) };
    }
    return { ...p, text: normalizeText(p.text) };
  });

  const consolidatedText = pages
    .map((p) => `=== PÁGINA ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');

  return {
    pages,
    totalPages: native.totalPages,
    scannedPageCount: scannedPageNumbers.length,
    consolidatedText,
  };
}
