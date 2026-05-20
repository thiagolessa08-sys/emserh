import { describe, it, expect, vi } from 'vitest';
import { extractPdfHybrid } from '@/lib/pdf-extractor';

vi.mock('@/lib/pdf-native-extractor', () => ({
  extractNative: vi.fn(async () => ({
    pages: [
      {
        pageNumber: 1,
        text: 'texto nativo da página 1 com mais de cem caracteres aqui ' + 'x'.repeat(100),
        isScanned: false,
        textItems: [],
      },
      { pageNumber: 2, text: '', isScanned: true, textItems: [] },
      { pageNumber: 3, text: 'curto', isScanned: true, textItems: [] },
    ],
    totalPages: 3,
  })),
}));

vi.mock('@/lib/ocr-mistral', () => ({
  ocrPagesViaMistral: vi.fn(async (_buf: Buffer, pages: number[]) => {
    const out: Record<number, string> = {};
    for (const p of pages) out[p] = `OCR resultado pagina ${p}`;
    return out;
  }),
}));

describe('extractPdfHybrid', () => {
  it('usa texto nativo onde existe e OCR em páginas escaneadas', async () => {
    const buffer = Buffer.from('fake');
    const result = await extractPdfHybrid(buffer);
    expect(result.pages[0].text).toContain('texto nativo');
    expect(result.pages[1].text).toBe('OCR resultado pagina 2');
    expect(result.pages[2].text).toBe('OCR resultado pagina 3');
    expect(result.scannedPageCount).toBe(2);
  });
});
