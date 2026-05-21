import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface AnnotationRequest {
  pageNumber: number;
  color: 'green' | 'red' | 'yellow';
  label: string;
}

const COLOR_MAP = {
  green: rgb(0.06, 0.52, 0.06),
  red: rgb(0.72, 0.06, 0.06),
  yellow: rgb(0.80, 0.60, 0.0),
};

const TEXT_COLOR_MAP = {
  green: rgb(1, 1, 1),
  red: rgb(1, 1, 1),
  yellow: rgb(0, 0, 0),
};

export async function annotatePdf(
  pdfBuffer: Buffer,
  annotations: AnnotationRequest[],
): Promise<Buffer> {
  const doc = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.pageNumber - 1];
    if (!page) continue;

    const { width } = page.getSize();
    const fontSize = 10;
    const rectHeight = 30;
    const rectY = 8;
    const color = COLOR_MAP[ann.color];
    const textColor = TEXT_COLOR_MAP[ann.color];

    page.drawRectangle({
      x: 8,
      y: rectY,
      width: width - 16,
      height: rectHeight,
      color,
      opacity: 0.92,
    });

    page.drawText(ann.label, {
      x: 14,
      y: rectY + (rectHeight - fontSize) / 2,
      size: fontSize,
      font,
      color: textColor,
    });
  }

  return Buffer.from(await doc.save());
}
