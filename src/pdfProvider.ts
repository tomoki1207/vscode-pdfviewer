import * as vscode from 'vscode';
import { PdfPreview, ViewerMessage } from './pdfPreview';
import { Settings } from './settings';

export interface ViewerMessageEvent {
  readonly uri: vscode.Uri;
  readonly message: ViewerMessage;
}

export class PdfCustomProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'pdf.preview';

  private readonly _previews = new Set<PdfPreview>();
  private _activePreview: PdfPreview | undefined;

  private readonly _onDidReceiveViewerMessage =
    new vscode.EventEmitter<ViewerMessageEvent>();
  public readonly onDidReceiveViewerMessage =
    this._onDidReceiveViewerMessage.event;

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly settings: Settings
  ) {}

  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: (): void => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new PdfPreview(
      this.extensionRoot,
      this.settings,
      document.uri,
      webviewEditor,
      (message) =>
        this._onDidReceiveViewerMessage.fire({ uri: document.uri, message })
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
      } else if (this._activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined);
      }
    });
  }

  public get activePreview(): PdfPreview | undefined {
    return this._activePreview;
  }

  private setActivePreview(value: PdfPreview | undefined): void {
    this._activePreview = value;
  }

  public dispose(): void {
    this._onDidReceiveViewerMessage.dispose();
  }
}
