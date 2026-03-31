import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { PDFDocument } from 'pdf-lib';
import { PdfCustomProvider } from './pdfProvider';

// --- INICIO DE NUESTRA FUNCIÓN AUXILIAR ---
/**
 * Convierte un string de rango (ej. "2, 4-6") en un array de números ([2, 4, 5, 6]).
 * @param rangeStr El string introducido por el usuario.
 * @returns Un array de números de página únicos y ordenados.
 */
function parsePageRange(rangeStr: string): number[] {
  const pages = new Set<number>();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (trimmedPart.includes('-')) {
      const [start, end] = trimmedPart.split('-').map(num => parseInt(num, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    } else {
      const pageNum = parseInt(trimmedPart, 10);
      if (!isNaN(pageNum)) {
        pages.add(pageNum);
      }
    }
  }
  // Convertimos el Set a un array y lo ordenamos numéricamente.
  return Array.from(pages).sort((a, b) => a - b);
}
// --- FIN DE NUESTRA FUNCIÓN AUXILIAR ---


export function activate(context: vscode.ExtensionContext): void {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'santt997.pdfPlusViewer',
      new PdfCustomProvider(extensionRoot),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pdfviewer.deletePage', async () => {
      const activePreview = PdfCustomProvider.activePreview;
      if (!activePreview) {
        vscode.window.showErrorMessage('No active PDF preview found. Please open a PDF file.');
        return;
      }
      const targetPath = activePreview.resource.fsPath;

      // --- CAMBIAMOS EL PROMPT Y LA VALIDACIÓN ---
      const pageStr = await vscode.window.showInputBox({
        prompt: 'Enter page(s) to delete (e.g., 2, 4-6, 8)',
        validateInput: text => {
          // Una validación simple para guiar al usuario
          return /^[0-9,\s-]*$/.test(text) ? null : 'Invalid characters. Use numbers, commas, and hyphens.';
        }
      });
      if (!pageStr) { return; }

      // --- USAMOS NUESTRA FUNCIÓN PARA OBTENER LA LISTA DE PÁGINAS ---
      const pagesToDelete = parsePageRange(pageStr);
      if (pagesToDelete.length === 0) {
        vscode.window.showErrorMessage('No valid pages to delete.');
        return;
      }

      try {
        const pdfBytes = await fs.readFile(targetPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Validamos que todas las páginas existan
        const invalidPages = pagesToDelete.filter(p => p > totalPages || p <= 0);
        if (invalidPages.length > 0) {
          vscode.window.showErrorMessage(`Invalid page number(s): ${invalidPages.join(', ')}. The PDF has ${totalPages} pages.`);
          return;
        }
        if (pagesToDelete.length >= totalPages) {
          vscode.window.showErrorMessage('Cannot delete all pages of a PDF.');
          return;
        }

        // --- BORRAMOS LAS PÁGINAS EN ORDEN INVERSO ---
        // Es crucial borrar de mayor a menor para no alterar los índices de las páginas que aún no hemos borrado.
        const sortedPages = pagesToDelete.sort((a, b) => b - a);
        for (const pageNum of sortedPages) {
          pdfDoc.removePage(pageNum - 1); // Restamos 1 para el índice base 0
        }
        
        const pdfBytesSaved = await pdfDoc.save();
        await fs.writeFile(targetPath, pdfBytesSaved);
        
        vscode.window.showInformationMessage(`Page(s) ${pageStr} deleted successfully.`);
        
        activePreview.reload();

      } catch (e) {
        vscode.window.showErrorMessage('Error deleting pages: ' + (e as Error).message);
      }
    })
  );
}

export function deactivate(): void {}