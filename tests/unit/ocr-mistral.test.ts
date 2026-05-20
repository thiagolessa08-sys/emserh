import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ocrPagesViaMistral } from '@/lib/ocr-mistral';

describe('ocrPagesViaMistral', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';
  });

  it('faz uma chamada por página e retorna mapa pagina→texto', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [{ index: 0, markdown: 'OCR texto da página' }] }),
    });
    const result = await ocrPagesViaMistral(Buffer.from('fake-pdf'), [3, 7]);
    expect(result).toEqual({ 3: 'OCR texto da página', 7: 'OCR texto da página' });
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
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
