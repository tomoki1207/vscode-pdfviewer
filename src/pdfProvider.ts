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
    const path = `${this.getUri('lib', 'web', 'viewer.html')}?file=${docPath}`
    const body =
      `
    <!doctype html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin:0px;padding:0px;overflow:hidden">
        <iframe src="${path}" frameborder="0" style="overflow:hidden;overflow-x:hidden;overflow-y:hidden;height:100%;width:100%;position:absolute;top:0px;left:0px;right:0px;bottom:0px" height="100%" width="100%"></iframe>
    </body>
    `


    return body;
  }
}