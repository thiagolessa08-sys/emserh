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

// Envia todas as páginas escaneadas em UMA única chamada à Mistral (muito mais rápido que N chamadas)
export async function ocrPagesViaMistral(
  pdfBuffer: Buffer,
  pageNumbers: number[],
): Promise<Record<number, string>> {
  const base64 = pdfBuffer.toString('base64');

  logger.info({ pages: pageNumbers.length }, 'ocr_start');

  const response = await fetch(ENDPOINT(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY()}`,
    },
    signal: AbortSignal.timeout(120_000), // 2 minutos máximo
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: 'document_url', document_url: `data:application/pdf;base64,${base64}` },
      pages: pageNumbers.map((p) => p - 1), // Mistral usa 0-indexed; envia todas de uma vez
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mistral OCR ${response.status}: ${body}`);
  }

  const data: MistralOcrResponse = await response.json();
  const result: Record<number, string> = {};

  for (const page of data.pages ?? []) {
    const pageNum = page.index + 1; // converte de volta para 1-indexed
    result[pageNum] = page.markdown ?? '';
    logger.info({ pageNum, chars: result[pageNum].length }, 'ocr_page_done');
  }

  logger.info({ pages: pageNumbers.length, returned: Object.keys(result).length }, 'ocr_done');
  return result;
}
