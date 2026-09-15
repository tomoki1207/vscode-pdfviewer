import * as vscode from 'vscode';
import { PdfPreview } from './pdfPreview';
import { addHighlights, HighlightRectangle } from './pdfAnnotations';
import { disposeAll } from './disposable';

export class PdfCustomDocument implements vscode.CustomDocument {
  public constructor(
    public readonly uri: vscode.Uri,
    public data: Uint8Array
  ) {}

  // The document only owns in-memory bytes, so there are no resources to release.
  public dispose(): void {}
}

export class PdfCustomProvider
  implements vscode.CustomEditorProvider<PdfCustomDocument>, vscode.Disposable {
  public static readonly viewType = 'pdf.preview';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<PdfCustomDocument>
  >();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument
    .event;
  private readonly _previews = new Set<PdfPreview>();
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _highlightOperations = new WeakMap<
    PdfCustomDocument,
    Promise<void>
  >();
  private _activePreview: PdfPreview | undefined;

  constructor(private readonly extensionRoot: vscode.Uri) {}

  public dispose(): void {
    disposeAll(this._disposables);
    for (const preview of this._previews) {
      preview.dispose();
    }
    this._previews.clear();
    this._onDidChangeCustomDocument.dispose();
  }

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<PdfCustomDocument> {
    const source = openContext.backupId
      ? vscode.Uri.parse(openContext.backupId)
      : uri;
    const data = await vscode.workspace.fs.readFile(source);
    return new PdfCustomDocument(uri, data);
  }

  public async resolveCustomEditor(
    document: PdfCustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new PdfPreview(
      this.extensionRoot,
      document.uri,
      webviewEditor,
      (rectangles) => this.applyHighlights(document, rectangles)
    );
    this._previews.add(preview);
    this.setActivePreview(preview);

    this._disposables.push(
      webviewEditor.onDidDispose(() => {
        preview.dispose();
        this._previews.delete(preview);
        if (this._activePreview === preview) {
          this.setActivePreview(undefined);
        }
      })
    );

    this._disposables.push(
      webviewEditor.onDidChangeViewState(() => {
        if (webviewEditor.active) {
          this.setActivePreview(preview);
        } else if (this._activePreview === preview && !webviewEditor.active) {
          this.setActivePreview(undefined);
        }
      })
    );
  }

  public async saveCustomDocument(document: PdfCustomDocument): Promise<void> {
    await vscode.workspace.fs.writeFile(document.uri, document.data);
  }

  public async saveCustomDocumentAs(
    document: PdfCustomDocument,
    destination: vscode.Uri
  ): Promise<void> {
    await vscode.workspace.fs.writeFile(destination, document.data);
  }

  public async revertCustomDocument(
    document: PdfCustomDocument
  ): Promise<void> {
    document.data = await vscode.workspace.fs.readFile(document.uri);
    this.reloadPreviews(document.uri);
  }

  public async backupCustomDocument(
    document: PdfCustomDocument,
    context: vscode.CustomDocumentBackupContext
  ): Promise<vscode.CustomDocumentBackup> {
    await vscode.workspace.fs.writeFile(context.destination, document.data);
    return {
      id: context.destination.toString(),
      delete: (): void => {
        void vscode.workspace.fs.delete(context.destination, {
          useTrash: false,
        });
      },
    };
  }

  private async applyHighlights(
    document: PdfCustomDocument,
    rectangles: HighlightRectangle[]
  ): Promise<void> {
    if (!Array.isArray(rectangles) || rectangles.length === 0) {
      return;
    }

    const previous =
      this._highlightOperations.get(document) || Promise.resolve();
    const operation = previous.then(async () => {
      try {
        document.data = await addHighlights(document.data, rectangles);
        this._onDidChangeCustomDocument.fire({ document });
        this.reloadPreviews(document.uri, document.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.reloadPreviews(document.uri, document.data);
        void vscode.window.showErrorMessage(
          `Could not create PDF highlight: ${message}`
        );
      }
    });
    this._highlightOperations.set(document, operation);
    await operation;
  }

  private reloadPreviews(uri: vscode.Uri, data?: Uint8Array): void {
    for (const preview of this._previews) {
      if (preview.resource.toString() === uri.toString()) {
        preview.reload(data);
      }
    }
  }

  public get activePreview(): PdfPreview | undefined {
    return this._activePreview;
  }

  private setActivePreview(value: PdfPreview | undefined): void {
    this._activePreview = value;
  }
}
