import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';

/**
 * Borra una página de un PDF y guarda el resultado.
 * @param filePath Ruta al archivo PDF original
 * @param pageNumber Número de página a borrar (empezando desde 1)
 * @param outputPath Ruta donde guardar el PDF modificado
 */
export async function deletePdfPage(filePath: string, pageNumber: number, outputPath: string) {
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (pageNumber < 1 || pageNumber > pdfDoc.getPageCount()) {
    throw new Error('Número de página fuera de rango');
  }

  pdfDoc.removePage(pageNumber - 1);

  const newPdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, newPdfBytes);
}
