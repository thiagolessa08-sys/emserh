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

// Tamanho máximo de páginas por lote — evita timeout e limites da API Mistral
const OCR_BATCH_SIZE = 40;
const OCR_BATCH_TIMEOUT_MS = 180_000; // 3 min por lote

async function ocrBatch(
  base64: string,
  batchPageNumbers: number[],
  batchIndex: number,
): Promise<Record<number, string>> {
  logger.info({ batch: batchIndex, pages: batchPageNumbers.length, firstPage: batchPageNumbers[0] }, 'ocr_batch_start');

  const response = await fetch(ENDPOINT(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY()}`,
    },
    signal: AbortSignal.timeout(OCR_BATCH_TIMEOUT_MS),
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: 'document_url', document_url: `data:application/pdf;base64,${base64}` },
      pages: batchPageNumbers.map((p) => p - 1), // Mistral usa 0-indexed
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ batch: batchIndex, status: response.status, body }, 'ocr_batch_error');
    // Falha ALTA: melhor abortar com erro claro do que produzir um relatório
    // enganoso (páginas sem texto viram falsos "documento não localizado").
    const first = batchPageNumbers[0];
    const last = batchPageNumbers[batchPageNumbers.length - 1];
    throw new Error(
      `Mistral OCR ${response.status} no lote de páginas ${first}-${last}: ${body}`,
    );
  }

  const data: MistralOcrResponse = await response.json();
  const result: Record<number, string> = {};

  for (const page of data.pages ?? []) {
    const pageNum = page.index + 1;
    result[pageNum] = page.markdown ?? '';
  }

  logger.info({ batch: batchIndex, returned: Object.keys(result).length }, 'ocr_batch_done');
  return result;
}

/**
 * Envia páginas escaneadas para a Mistral OCR em lotes de OCR_BATCH_SIZE páginas.
 * Processos com centenas de páginas escaneadas não cabem em uma única chamada
 * (timeout, limite de payload). Se um lote falhar, lança erro indicando as
 * páginas afetadas — preferível a um relatório enganoso com documentos "ausentes".
 */
export async function ocrPagesViaMistral(
  pdfBuffer: Buffer,
  pageNumbers: number[],
): Promise<Record<number, string>> {
  const base64 = pdfBuffer.toString('base64');

  logger.info({ totalPages: pageNumbers.length, batchSize: OCR_BATCH_SIZE }, 'ocr_start');

  const result: Record<number, string> = {};

  // Divide em lotes e processa sequencialmente para não saturar a API
  for (let i = 0; i < pageNumbers.length; i += OCR_BATCH_SIZE) {
    const batch = pageNumbers.slice(i, i + OCR_BATCH_SIZE);
    const batchIndex = Math.floor(i / OCR_BATCH_SIZE);
    const batchResult = await ocrBatch(base64, batch, batchIndex);
    Object.assign(result, batchResult);
  }

  logger.info({ requested: pageNumbers.length, returned: Object.keys(result).length }, 'ocr_done');
  return result;
}
