import { PDFDocument } from 'pdf-lib';
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

// Retry para erros transitórios (429 rate limit e 5xx) com backoff exponencial
const OCR_MAX_ATTEMPTS = 6;
const OCR_RETRY_MAX_DELAY_MS = 60_000;
const OCR_RETRY_BASE_MS = () => Number(process.env.MISTRAL_OCR_RETRY_BASE_MS ?? 2_000);

const isRetryable = (status: number) => status === 429 || status >= 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelayMs(response: Response, attempt: number): number {
  // Respeita Retry-After (segundos) quando a API informar
  const retryAfter = Number(response.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, OCR_RETRY_MAX_DELAY_MS);
  }
  const exp = OCR_RETRY_BASE_MS() * 2 ** (attempt - 1);
  const jitter = Math.random() * OCR_RETRY_BASE_MS();
  return Math.min(exp + jitter, OCR_RETRY_MAX_DELAY_MS);
}

/**
 * Conteúdo enviado em um lote. Preferimos um sub-PDF contendo só as páginas do
 * lote: o payload fica muito menor e a Mistral não contabiliza o documento
 * inteiro a cada chamada. Sem sub-PDF (falha ao abrir o PDF com pdf-lib),
 * enviamos o PDF completo com o parâmetro `pages`.
 */
type BatchPayload =
  | { kind: 'subset'; base64: string }
  | { kind: 'full'; base64: string };

async function ocrBatch(
  payload: BatchPayload,
  batchPageNumbers: number[],
  batchIndex: number,
): Promise<Record<number, string>> {
  logger.info(
    { batch: batchIndex, pages: batchPageNumbers.length, firstPage: batchPageNumbers[0], mode: payload.kind },
    'ocr_batch_start',
  );

  const body = JSON.stringify({
    model: 'mistral-ocr-latest',
    document: { type: 'document_url', document_url: `data:application/pdf;base64,${payload.base64}` },
    ...(payload.kind === 'full' ? { pages: batchPageNumbers.map((p) => p - 1) } : {}), // Mistral usa 0-indexed
  });

  let response: Response;
  for (let attempt = 1; ; attempt++) {
    response = await fetch(ENDPOINT(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY()}`,
      },
      signal: AbortSignal.timeout(OCR_BATCH_TIMEOUT_MS),
      body,
    });

    if (response.ok || !isRetryable(response.status) || attempt >= OCR_MAX_ATTEMPTS) break;

    const delay = retryDelayMs(response, attempt);
    logger.warn({ batch: batchIndex, status: response.status, attempt, delayMs: Math.round(delay) }, 'ocr_batch_retry');
    await response.text().catch(() => undefined); // libera o corpo da resposta
    await sleep(delay);
  }

  if (!response.ok) {
    const text = await response.text();
    logger.error({ batch: batchIndex, status: response.status, body: text }, 'ocr_batch_error');
    // Falha ALTA: melhor abortar com erro claro do que produzir um relatório
    // enganoso (páginas sem texto viram falsos "documento não localizado").
    const first = batchPageNumbers[0];
    const last = batchPageNumbers[batchPageNumbers.length - 1];
    throw new Error(
      `Mistral OCR ${response.status} no lote de páginas ${first}-${last}: ${text}`,
    );
  }

  const data: MistralOcrResponse = await response.json();
  const result: Record<number, string> = {};

  for (const page of data.pages ?? []) {
    // No sub-PDF o índice é a posição dentro do lote; no PDF completo é a página original
    const pageNum = payload.kind === 'subset' ? batchPageNumbers[page.index] : page.index + 1;
    if (pageNum !== undefined) result[pageNum] = page.markdown ?? '';
  }

  logger.info({ batch: batchIndex, returned: Object.keys(result).length }, 'ocr_batch_done');
  return result;
}

async function buildSubsetPdf(source: PDFDocument, pageNumbers: number[]): Promise<string> {
  const subset = await PDFDocument.create();
  const copied = await subset.copyPages(source, pageNumbers.map((p) => p - 1));
  copied.forEach((page) => subset.addPage(page));
  return Buffer.from(await subset.save()).toString('base64');
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
  logger.info({ totalPages: pageNumbers.length, batchSize: OCR_BATCH_SIZE }, 'ocr_start');

  let source: PDFDocument | null = null;
  try {
    source = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  } catch (err) {
    logger.warn({ err: String(err) }, 'ocr_subset_unavailable');
  }
  let fullBase64: string | null = null;

  const result: Record<number, string> = {};

  // Divide em lotes e processa sequencialmente para não saturar a API
  for (let i = 0; i < pageNumbers.length; i += OCR_BATCH_SIZE) {
    const batch = pageNumbers.slice(i, i + OCR_BATCH_SIZE);
    const batchIndex = Math.floor(i / OCR_BATCH_SIZE);

    let payload: BatchPayload | null = null;
    if (source) {
      try {
        payload = { kind: 'subset', base64: await buildSubsetPdf(source, batch) };
      } catch (err) {
        logger.warn({ batch: batchIndex, err: String(err) }, 'ocr_subset_failed');
      }
    }
    if (!payload) {
      fullBase64 ??= pdfBuffer.toString('base64');
      payload = { kind: 'full', base64: fullBase64 };
    }

    const batchResult = await ocrBatch(payload, batch, batchIndex);
    Object.assign(result, batchResult);
  }

  logger.info({ requested: pageNumbers.length, returned: Object.keys(result).length }, 'ocr_done');
  return result;
}
