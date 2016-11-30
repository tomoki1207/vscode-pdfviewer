/* tslint:disable:quotemark */
"use strict";
import * as vscode from "vscode";
import * as path from "path";

export class PdfDocumentContentProvider implements vscode.TextDocumentContentProvider {

  public constructor(private _context: vscode.ExtensionContext) { }

  private getPath(p: string): string {
    return path.join(this._context.extensionPath, p);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    const docUri = encodeURIComponent(uri.query);
    const head = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta http-equiv="Content-type" content="text/html;charset=UTF-8">',
      `<link rel="stylesheet" type="text/css" href="${this.getPath("lib/pdf.css")}">`,
      '</head>'
    ].join("\n");

    const body = [
      '<body>',
      `<iframe id="pdf-viewer" src="${this.getPath("lib/web/viewer.html")}?file=${docUri}">`,
      '</body>'
    ].join("\n");

    const tail = [
      '</html>'
    ].join("\n");

    return head + body + tail;
  }
}