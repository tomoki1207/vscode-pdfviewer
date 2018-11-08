"use strict";

import * as vscode from 'vscode';
import {
  ExtensionContext,
  TextDocument,
  Uri,
  WebviewPanel,
} from 'vscode';
import { PdfDocumentContentProvider } from './pdfProvider';

const path = require("path");

export function activate(context: ExtensionContext) {

  const openedPanels: WebviewPanel[] = [];
  const provider = new PdfDocumentContentProvider(context);

  const revealIfAlreadyOpened = (uri: Uri): boolean => {
    const opened = openedPanels.find(panel => panel.viewType === uri.fsPath);
    if (!opened)
      return false;
    opened.reveal(opened.viewColumn);
    return true;
  }

  const registerPanel = (panel: WebviewPanel): void => {
    panel.onDidDispose(() => {
      openedPanels.splice(openedPanels.indexOf(panel), 1);
    })
    openedPanels.push(panel);
  }

  const previewAndCloseSrcDoc = async (document: TextDocument): Promise<void> => {
    if (document.languageId === "pdf") {
      vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      if (!revealIfAlreadyOpened(document.uri)) {
        registerPanel(showPreview(document.uri, provider));
      }
    }
  }

  const openedEvent = vscode.workspace.onDidOpenTextDocument((document: TextDocument) => {
    previewAndCloseSrcDoc(document);
  });

  const previewCmd = vscode.commands.registerCommand("extension.pdf-preview", (uri: Uri) => {
    if(!revealIfAlreadyOpened(uri)) {
      registerPanel(showPreview(uri, provider));
    }
  });

  // If pdf file is already opened when load workspace.
  if (vscode.window.activeTextEditor) {
    previewAndCloseSrcDoc(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(openedEvent, previewCmd);
}

function showPreview(uri: Uri, provider: PdfDocumentContentProvider): WebviewPanel {
  const basename = path.basename(uri.fsPath);
  const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : 1;
  const panel = vscode.window.createWebviewPanel(
    uri.fsPath, // treated as identity
    basename,
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  panel.webview.html = provider.provideTextDocumentContent(uri);
  return panel;
}

export function deactivate() {
}