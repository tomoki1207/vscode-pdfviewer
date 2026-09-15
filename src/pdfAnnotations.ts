import { PDFDocument } from 'pdf-lib';

export interface HighlightRectangle {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

function isValidRectangle(
  rectangle: HighlightRectangle | null | undefined,
  pageCount: number
): boolean {
  return (
    rectangle !== null &&
    rectangle !== undefined &&
    typeof rectangle === 'object' &&
    Number.isInteger(rectangle.page) &&
    rectangle.page >= 1 &&
    rectangle.page <= pageCount &&
    Number.isFinite(rectangle.left) &&
    Number.isFinite(rectangle.top) &&
    Number.isFinite(rectangle.width) &&
    Number.isFinite(rectangle.height) &&
    rectangle.left >= 0 &&
    rectangle.top >= 0 &&
    rectangle.width > 0 &&
    rectangle.height > 0 &&
    rectangle.left + rectangle.width <= 1 &&
    rectangle.top + rectangle.height <= 1
  );
}

function toPdfCoordinates(
  page: ReturnType<PDFDocument['getPage']>,
  rectangle: HighlightRectangle
): { left: number; right: number; top: number; bottom: number } {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const renderedWidth =
    page.getRotation().angle % 180 === 0 ? pageWidth : pageHeight;
  const renderedHeight =
    page.getRotation().angle % 180 === 0 ? pageHeight : pageWidth;
  const x1 = rectangle.left * renderedWidth;
  const x2 = (rectangle.left + rectangle.width) * renderedWidth;
  const y1 = rectangle.top * renderedHeight;
  const y2 = (rectangle.top + rectangle.height) * renderedHeight;

  switch (page.getRotation().angle) {
    case 90:
      return {
        left: pageWidth - y2,
        right: pageWidth - y1,
        top: x2,
        bottom: x1,
      };
    case 180:
      return {
        left: pageWidth - x2,
        right: pageWidth - x1,
        top: pageHeight - y1,
        bottom: pageHeight - y2,
      };
    case 270:
      return {
        left: y1,
        right: y2,
        top: pageHeight - x1,
        bottom: pageHeight - x2,
      };
    default:
      return {
        left: x1,
        right: x2,
        top: pageHeight - y1,
        bottom: pageHeight - y2,
      };
  }
}

/**
 * Adds standard PDF highlight annotations and returns the updated document.
 * Viewer rectangles use normalized, top-left coordinates; PDF coordinates use
 * points with the origin at the bottom-left of the page.
 */
export async function addHighlights(
  data: Uint8Array,
  rectangles: HighlightRectangle[]
): Promise<Uint8Array> {
  const document = await PDFDocument.load(data);

  for (const rectangle of rectangles) {
    if (!isValidRectangle(rectangle, document.getPageCount())) {
      throw new Error('Invalid PDF highlight rectangle.');
    }

    const page = document.getPage(rectangle.page - 1);
    const { left, right, top, bottom } = toPdfCoordinates(page, rectangle);

    const annotation = document.context.obj({
      Type: 'Annot',
      Subtype: 'Highlight',
      Rect: [left, bottom, right, top],
      QuadPoints: [left, top, right, top, left, bottom, right, bottom],
      C: [1, 1, 0],
      CA: 0.4,
      F: 4,
    });
    page.node.addAnnot(document.context.register(annotation));
  }

  return document.save();
}
