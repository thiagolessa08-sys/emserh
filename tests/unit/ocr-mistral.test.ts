// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ocrPagesViaMistral } from '@/lib/ocr-mistral';

const fetchMock = () => fetch as unknown as ReturnType<typeof vi.fn>;

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage();
  return Buffer.from(await doc.save());
}

async function sentPageCount(callIndex: number): Promise<number> {
  const body = JSON.parse(fetchMock().mock.calls[callIndex][1].body);
  const base64 = body.document.document_url.replace('data:application/pdf;base64,', '');
  const doc = await PDFDocument.load(Buffer.from(base64, 'base64'));
  return doc.getPageCount();
}

describe('ocrPagesViaMistral', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
    process.env.MISTRAL_OCR_RETRY_BASE_MS = '1';
  });

  it('envia sub-PDF só com as páginas do lote e mapeia de volta para a página original', async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [
          { index: 0, markdown: 'OCR página 3' },
          { index: 1, markdown: 'OCR página 7' },
        ],
      }),
    });
    const result = await ocrPagesViaMistral(await makePdf(10), [3, 7]);
    expect(result).toEqual({ 3: 'OCR página 3', 7: 'OCR página 7' });
    expect(fetchMock().mock.calls.length).toBe(1);
    expect(await sentPageCount(0)).toBe(2);
    expect(JSON.parse(fetchMock().mock.calls[0][1].body).pages).toBeUndefined();
  });

  it('cai para o PDF completo com `pages` quando não consegue abrir o PDF', async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [{ index: 2, markdown: 'OCR página 3' }] }),
    });
    const result = await ocrPagesViaMistral(Buffer.from('fake-pdf'), [3]);
    expect(result).toEqual({ 3: 'OCR página 3' });
    expect(JSON.parse(fetchMock().mock.calls[0][1].body).pages).toEqual([2]);
  });

  it('divide em múltiplos lotes quando há mais de 40 páginas', async () => {
    fetchMock().mockResolvedValue({ ok: true, json: async () => ({ pages: [] }) });
    const muitasPaginas = Array.from({ length: 90 }, (_, i) => i + 1);
    await ocrPagesViaMistral(await makePdf(90), muitasPaginas);
    // 90 páginas / 40 por lote = 3 lotes (40 + 40 + 10)
    expect(fetchMock().mock.calls.length).toBe(3);
    expect(await sentPageCount(2)).toBe(10);
  });

  it('lança erro quando Mistral retorna 401', async () => {
    fetchMock().mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(ocrPagesViaMistral(await makePdf(1), [1])).rejects.toThrow(/401/);
    // 401 não é transitório: sem retry
    expect(fetchMock().mock.calls.length).toBe(1);
  });

  it('faz retry em 429 e conclui quando a API volta a responder', async () => {
    fetchMock()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limit exceeded' })
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limit exceeded' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [{ index: 0, markdown: 'ok' }] }),
      });
    const result = await ocrPagesViaMistral(await makePdf(1), [1]);
    expect(result).toEqual({ 1: 'ok' });
    expect(fetchMock().mock.calls.length).toBe(3);
  });

  it('lança erro após esgotar as tentativas em 429', async () => {
    fetchMock().mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate limit exceeded' });
    await expect(ocrPagesViaMistral(await makePdf(1), [1])).rejects.toThrow(/429/);
    expect(fetchMock().mock.calls.length).toBe(6);
  });
});
