"use strict";

import * as vscode from "vscode";
import * as path from "path";

export class PdfDocumentContentProvider implements vscode.TextDocumentContentProvider {

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public constructor(private _context: vscode.ExtensionContext) { }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    let docUri = vscode.Uri.parse(uri.query);
    return this.snippet(docUri.fsPath);
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  public update(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }

  private getPath(p: string): string {
    return path.join(this._context.extensionPath, p);
  }

  private snippet(pdfPath: string): string {
    let css = `<link rel="stylesheet" type="text/css" href="${this.getPath("lib/pdf.css")}">`;
    let div = `<div id="pdf-container"></div>`;
    let pdfJs = `<script type="text/javascript" src="${this.getPath("lib/pdf.js")}"></script>`;
    // let pdfWorker = `<script type="text/javascript">PDFJS.workerSrc="${this.getPath("lib/pdf.worker.js")}";</script>`;
    let vars = `<script type="text/javascript">var pdfPath = '${pdfPath.replace(/\\/g, "/")}';</script>`;
    let renderScript = `<script type="text/javascript" src="${this.getPath("lib/pdf.render.js")}"></script>`;

    return `<!DOCTYPE html><html><head>${css}</head><body>${div}${pdfJs}${vars}${renderScript}</body></html>`;
  }
}