import * as vscode from 'vscode'
import { PdfPreview } from './pdfPreview'

export class PdfCustomProvider implements vscode.CustomEditorProvider {
  public static readonly viewType = 'pdf.preview'

  private readonly _previews = new Set<PdfPreview>()
  private _activePreview: PdfPreview | undefined

  constructor(private readonly extensionRoot: vscode.Uri) { }

  public async openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => { } }
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel,
  ): Promise<void> {
    const preview = new PdfPreview(this.extensionRoot, document.uri, webviewEditor)
    this._previews.add(preview)
    this.setActivePreview(preview)

    webviewEditor.onDidDispose(() => { this._previews.delete(preview) })

    webviewEditor.onDidChangeViewState(() => {
      if (webviewEditor.active) {
        this.setActivePreview(preview)
      } else if (this._activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined)
      }
    })
  }

  public get activePreview() { return this._activePreview }

  private setActivePreview(value: PdfPreview | undefined): void {
    this._activePreview = value
  }
}
