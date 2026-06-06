import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ocrPagesViaMistral } from '@/lib/ocr-mistral';

describe('ocrPagesViaMistral', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
  });

  it('mapeia pelo índice da resposta (1-indexed) em um único lote', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [
          { index: 2, markdown: 'OCR página 3' },
          { index: 6, markdown: 'OCR página 7' },
        ],
      }),
    });
    const result = await ocrPagesViaMistral(Buffer.from('fake-pdf'), [3, 7]);
    expect(result).toEqual({ 3: 'OCR página 3', 7: 'OCR página 7' });
    // 2 páginas cabem em 1 lote (OCR_BATCH_SIZE = 40)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('divide em múltiplos lotes quando há mais de 40 páginas', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [] }),
    });
    const muitasPaginas = Array.from({ length: 90 }, (_, i) => i + 1);
    await ocrPagesViaMistral(Buffer.from('x'), muitasPaginas);
    // 90 páginas / 40 por lote = 3 lotes (40 + 40 + 10)
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });

  it('lança erro quando Mistral retorna 401', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    await expect(ocrPagesViaMistral(Buffer.from('x'), [1])).rejects.toThrow(/401/);
  });
});
