// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { annotatePdf, type AnnotationRequest } from '@/lib/pdf-annotator';
import { PDFDocument } from 'pdf-lib';

async function makeOnePage(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

describe('annotatePdf', () => {
  it('retorna um Buffer de PDF válido quando não há anotações', async () => {
    const input = await makeOnePage();
    const result = await annotatePdf(input, []);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('retorna PDF com página anotada quando há anotações', async () => {
    const input = await makeOnePage();
    const annotations: AnnotationRequest[] = [
      { pageNumber: 1, color: 'green', label: 'CONFORME — INSS' },
    ];
    const result = await annotatePdf(input, annotations);
    expect(result).toBeInstanceOf(Buffer);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('ignora anotações em páginas inexistentes', async () => {
    const input = await makeOnePage();
    const annotations: AnnotationRequest[] = [
      { pageNumber: 99, color: 'red', label: 'página não existe' },
    ];
    const result = await annotatePdf(input, annotations);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(1);
  });
});
