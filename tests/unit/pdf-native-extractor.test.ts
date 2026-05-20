import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { extractNative } from '@/lib/pdf-native-extractor';

describe('extractNative', () => {
  it('extrai texto + páginas + coordenadas de um PDF nativo', async () => {
    const buffer = readFileSync('tests/fixtures/pdfs/sample-native.pdf');
    const result = await extractNative(buffer);
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0]).toMatchObject({
      pageNumber: 1,
      text: expect.any(String),
      isScanned: expect.any(Boolean),
      textItems: expect.any(Array),
    });
  }, 60_000);
});
