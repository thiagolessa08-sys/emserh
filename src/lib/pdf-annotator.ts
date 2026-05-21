import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface AnnotationRequest {
  pageNumber: number;
  color: 'green' | 'red' | 'yellow';
  label: string;
}

const COLOR_MAP = {
  green: rgb(0.18, 0.72, 0.18),
  red: rgb(0.88, 0.18, 0.18),
  yellow: rgb(1.0, 0.85, 0.0),
};

export async function annotatePdf(
  pdfBuffer: Buffer,
  annotations: AnnotationRequest[],
): Promise<Buffer> {
  const doc = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.pageNumber - 1];
    if (!page) continue;

    const { width } = page.getSize();
    const rectHeight = 20;
    const rectY = 10;
    const color = COLOR_MAP[ann.color];

    page.drawRectangle({
      x: 10,
      y: rectY,
      width: width - 20,
      height: rectHeight,
      color,
      opacity: 0.4,
    });

    page.drawText(ann.label, {
      x: 14,
      y: rectY + 5,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return Buffer.from(await doc.save());
}
