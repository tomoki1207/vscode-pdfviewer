"use strict";

import * as vscode from "vscode";
import { PdfDocumentContentProvider } from "./pdfProvider";

const path = require("path");

export function activate(context: vscode.ExtensionContext) {

  const provider = new PdfDocumentContentProvider(context);
  const registerProvider = vscode.workspace.registerTextDocumentContentProvider("pdf-preview", provider);

  const openedEvent = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    showPreview(document);
  });

  // for pdf file already opend.
  if (vscode.window.activeTextEditor) {
    showPreview(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(registerProvider, openedEvent);
}

function showPreview(document: vscode.TextDocument): void {
  if (!isPdfDocument(document)) {
    return;
  }

  let uri = document.uri;

  // close pdf raw file  
  let basename = path.basename(uri.fsPath);
  let columns = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : 1;
  vscode.commands.executeCommand("workbench.action.closeActiveEditor")
    .then(() => vscode.commands.executeCommand("vscode.previewHtml",
      buildPreviewUri(uri),
      columns,
      basename))
    .then(null, vscode.window.showErrorMessage);
}

function buildPreviewUri(uri: vscode.Uri): vscode.Uri {
  return uri.with({
    scheme: "pdf-preview",
    path: uri.path + ".rendered.pdf",
    query: uri.toString(),
  });
}

function isPdfDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "pdf" && document.uri.scheme !== "pdf-preview";
}

export function deactivate() {
}