"use strict";

import * as vscode from "vscode";
import { PdfDocumentContentProvider } from "./pdfProvider";

const path = require("path");

export function activate(context: vscode.ExtensionContext) {

  let provider = new PdfDocumentContentProvider(context);
  vscode.workspace.registerTextDocumentContentProvider("pdf-preview", provider);

  vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    showPreview(document);
  });

  // for pdf file already opend.
  if (vscode.window.activeTextEditor) {
    showPreview(vscode.window.activeTextEditor.document);
  }
}

function showPreview(document: vscode.TextDocument): void {
  if (!isPdfDocument(document)) {
    return;
  }

  let uri = document.uri;

  // close pdf raw file  
  let basename = path.basename(uri.fsPath);
  let columns = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : 1;
  vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  // preview
  vscode.commands.executeCommand("vscode.previewHtml",
    buildPreviewUri(uri),
    columns,
    basename
  ).then(null, vscode.window.showErrorMessage);
}

function buildPreviewUri(uri: vscode.Uri): vscode.Uri {
  return uri.with({
    scheme: "pdf-preview",
    path: uri.path + ".rendered",
    query: uri.toString(),
  });
}

function isPdfDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "pdf";
}

export function deactivate() {
}