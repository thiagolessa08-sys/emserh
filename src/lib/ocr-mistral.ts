import { logger } from '@/lib/logger';

const ENDPOINT = () => process.env.MISTRAL_OCR_ENDPOINT ?? 'https://api.mistral.ai/v1/ocr';
const API_KEY = () => {
  const k = process.env.MISTRAL_API_KEY;
  if (!k) throw new Error('MISTRAL_API_KEY não configurada');
  return k;
};

interface MistralOcrResponse {
  pages?: Array<{ index: number; markdown?: string }>;
}

export async function ocrPagesViaMistral(
  pdfBuffer: Buffer,
  pageNumbers: number[],
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  const base64 = pdfBuffer.toString('base64');

  for (const pageNum of pageNumbers) {
    const response = await fetch(ENDPOINT(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY()}`,
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: { type: 'document_base64', data: base64 },
        pages: [pageNum - 1], // Mistral usa 0-indexed
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mistral OCR ${response.status}: ${body}`);
    }
    const data: MistralOcrResponse = await response.json();
    const pageText = data.pages?.[0]?.markdown ?? '';
    result[pageNum] = pageText;
    logger.info({ pageNum, chars: pageText.length }, 'ocr_page_done');
  }
  return result;
}
