"use strict";

import * as vscode from "vscode";
import { PdfDocumentContentProvider } from "./pdfProvider";

const path = require("path");

export function activate(context: vscode.ExtensionContext) {

  const provider = new PdfDocumentContentProvider(context);
  const registerProvider = vscode.workspace.registerTextDocumentContentProvider("pdf-preview", provider);

  const openedEvent = vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
    showDocumentPreview(document);
  });

  const previewCmd = vscode.commands.registerCommand('extension.pdf-preview', (uri: vscode.Uri) => {
    showPreview(uri);
  });

  // for pdf file already opend.
  if (vscode.window.activeTextEditor) {
    showDocumentPreview(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(registerProvider, openedEvent, previewCmd);
}

function showDocumentPreview(document: vscode.TextDocument): void {
  if (document.languageId === "pdf") {
    showPreview(document.uri);
  }
}

function showPreview(uri: vscode.Uri): void {
  if (uri.scheme === "pdf-preview")
    return;

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

export function deactivate() {
}