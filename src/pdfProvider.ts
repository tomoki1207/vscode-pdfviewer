/* tslint:disable:quotemark */
"use strict";
import * as vscode from "vscode";
import * as path from "path";

export class PdfDocumentContentProvider implements vscode.TextDocumentContentProvider {

  public constructor(private _context: vscode.ExtensionContext) { }

  private getUri(...p: string[]): vscode.Uri {
    return vscode.Uri.file(path.join(this._context.extensionPath, ...p))
      .with({ scheme: 'vscode-resource' });
  }

  public provideTextDocumentContent(uri: vscode.Uri, state: any): string {
    const docPath = uri.with({ scheme: 'vscode-resource' });
    const head = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta http-equiv="Content-type" content="text/html;charset=UTF-8">',
      `<link rel="stylesheet" type="text/css" href="${this.getUri('lib', 'pdf.css')}">`,
      '</head>'
    ].join("\n");

    const body = [
      '<body>',
      `<script>
      (function () {
        // store state for revive
        const vscode = acquireVsCodeApi();
        vscode.setState(JSON.parse('${JSON.stringify(state)}'));
      }());
      </script>`,
      `<iframe id="pdf-viewer" src="${this.getUri('lib', 'web', 'viewer.html')}?file=${docPath}" />`,
      '</body>'
    ].join("\n");

    const tail = [
      '</html>'
    ].join("\n");

    return head + body + tail;
  }
}