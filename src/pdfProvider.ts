import * as vscode from 'vscode';
import { PdfPreview } from './pdfPreview';

// Clase "dummy" necesaria para que la interfaz de VS Code funcione
class PdfDocument implements vscode.CustomDocument {
    constructor(public readonly uri: vscode.Uri) {}
    dispose(): void {}
}

export class PdfCustomProvider implements vscode.CustomEditorProvider<vscode.CustomDocument> {
  // Propiedad estática para saber cuál es el visor activo
  public static activePreview?: PdfPreview;

  private readonly _previews = new Set<PdfPreview>();

  constructor(private readonly extensionRoot: vscode.Uri) {}

  // --- MÉTODOS OBLIGATORIOS QUE FALTABAN ---
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    throw new Error('Method not implemented.');
  }

  public async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return new PdfDocument(uri);
  }
  // --- FIN DE LOS MÉTODOS OBLIGATORIOS ---

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new PdfPreview(
      this.extensionRoot,
      document.uri,
      webviewEditor
    );
    this._previews.add(preview);
    this.setActivePreview(preview);

    webviewEditor.onDidDispose(() => {
      preview.dispose();
      this._previews.delete(preview);
    });

    webviewEditor.onDidChangeViewState(() => {
      if (webviewEditor.active) {
        this.setActivePreview(preview);
      } else if (PdfCustomProvider.activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined);
      }
    });
  }

  private setActivePreview(value: PdfPreview | undefined): void {
    PdfCustomProvider.activePreview = value;
  }
}