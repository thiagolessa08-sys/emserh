import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  isScanned: boolean;
  textItems: TextItem[];
}

export interface NativeExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
}

const SCANNED_THRESHOLD_CHARS = 100;

interface PdfjsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function extractNative(buffer: Buffer | Uint8Array): Promise<NativeExtractionResult> {
  const data = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items
      .filter((it): it is PdfjsTextItem => typeof (it as PdfjsTextItem).str === 'string')
      .map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height,
      }));
    const text = items.map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({
      pageNumber: i,
      text,
      isScanned: text.length < SCANNED_THRESHOLD_CHARS,
      textItems: items,
    });
  }
  return { pages, totalPages: pdf.numPages };
}
