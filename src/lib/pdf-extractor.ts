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

export async function extractPdfHybrid(pdfBuffer: Buffer): Promise<HybridExtractionResult> {
  const native = await extractNative(pdfBuffer);
  const scannedPageNumbers = native.pages.filter((p) => p.isScanned).map((p) => p.pageNumber);
  logger.info(
    { totalPages: native.totalPages, scanned: scannedPageNumbers.length },
    'extraction_started',
  );

  let ocrResults: Record<number, string> = {};
  if (scannedPageNumbers.length > 0) {
    ocrResults = await ocrPagesViaMistral(pdfBuffer, scannedPageNumbers);
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
