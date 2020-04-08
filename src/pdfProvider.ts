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
    <head>
      <link rel=”stylesheet” href=”${this.getUri('src', 'iframe.css')}”>
    </head>
    <body>
      <iframe src="${path}" 
      frameborder="0" 
      marginheight="0" 
      marginwidth="0" 
      width="100%" 
      height="100%" ></iframe >
    </body>
    `


    return body;
  }
}