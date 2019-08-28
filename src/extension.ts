"use strict";

import * as vscode from 'vscode';
import {
  ExtensionContext,
  TextDocument,
  Uri,
  WebviewPanel,
} from 'vscode';
import { PdfDocumentContentProvider } from './pdfProvider';
import * as path from "path";

const viewType = 'pdf.preview';

interface PdfPreviewPanel {
  panel: WebviewPanel,
  resource: Uri,
}

export function activate(context: ExtensionContext) {
  const openedPanels: PdfPreviewPanel[] = [];
  const provider = new PdfDocumentContentProvider(context);

  const revealIfAlreadyOpened = (uri: Uri): boolean => {
    const opened = openedPanels.find(panel => panel.resource.fsPath === uri.fsPath);
    if (!opened)
      return false;
    opened.panel.reveal(opened.panel.viewColumn);
    return true;
  }

  const registerPanel = (preview: PdfPreviewPanel): void => {
    preview.panel.onDidDispose(() => {
      openedPanels.splice(openedPanels.indexOf(preview), 1);
    })
    openedPanels.push(preview);
  }

  const previewAndCloseSrcDoc = async (document: TextDocument): Promise<void> => {
    if (document.languageId === "pdf") {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      if (!revealIfAlreadyOpened(document.uri)) {
        registerPanel(createPreview(context, document.uri, provider));
      }
    }
  }

  const openedEvent = vscode.workspace.onDidOpenTextDocument((document: TextDocument) => {
    previewAndCloseSrcDoc(document);
  });

  const previewCmd = vscode.commands.registerCommand("extension.pdf-preview", (uri: Uri) => {
    if(!revealIfAlreadyOpened(uri)) {
      registerPanel(createPreview(context ,uri, provider));
    }
  });

  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(viewType, {
      async deserializeWebviewPanel(panel: WebviewPanel, state: any) {
        const resource = Uri.parse(state.resource.fsPath);
        panel.title = panel.title || getPreviewTitle(resource);
        panel.webview.options = getWebviewOptions(context, resource);
        panel.webview.html = provider.provideTextDocumentContent(resource, state);
        registerPanel({ panel, resource })
      }
    })
  }

  // If pdf file is already opened when load workspace.
  if (vscode.window.activeTextEditor) {
    previewAndCloseSrcDoc(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(openedEvent, previewCmd);
}

function createPreview(context: ExtensionContext, uri: Uri, provider: PdfDocumentContentProvider): PdfPreviewPanel {
  const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : 1;
  const panel = vscode.window.createWebviewPanel(
    viewType,
    getPreviewTitle(uri),
    column,
    getWebviewOptions(context, uri)
  );
  panel.webview.html = provider.provideTextDocumentContent(uri, { resource: uri });
  return { panel, resource: uri };
}

function getPreviewTitle(uri: Uri): string {
  return path.basename(uri.fsPath);
}

function getWebviewOptions(context: ExtensionContext, uri: Uri) {
  return {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: getLocalResourceRoots(context, uri)
  }
}

function getLocalResourceRoots(
  context: ExtensionContext,
  resource: vscode.Uri
): vscode.Uri[] {
  const baseRoots = [vscode.Uri.file(context.extensionPath)];
  const folder = vscode.workspace.getWorkspaceFolder(resource);
  if (folder) {
    return baseRoots.concat(folder.uri);
  }

  if (!resource.scheme || resource.scheme === 'file') {
    return baseRoots.concat(vscode.Uri.file(path.dirname(resource.fsPath)));
  }

  return baseRoots;
}

export function deactivate() {
}