import * as vscode from 'vscode';
import { PdfCustomProvider, ViewerMessageEvent } from './pdfProvider';

export interface PdfPreviewApi {
  // Used by the integration tests to observe the viewer
  readonly onDidReceiveViewerMessage: vscode.Event<ViewerMessageEvent>;
}

export function activate(context: vscode.ExtensionContext): PdfPreviewApi {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  const log = vscode.window.createOutputChannel('PDF Preview', { log: true });
  // Register our custom editor provider
  const provider = new PdfCustomProvider(extensionRoot);
  context.subscriptions.push(
    log,
    provider,
    provider.onDidReceiveViewerMessage(({ uri, message }) => {
      if (message.type === 'error') {
        log.error(`${uri.fsPath}: ${message.kind}\n${message.detail}`);
      }
    }),
    vscode.window.registerCustomEditorProvider(
      PdfCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false, // default
          retainContextWhenHidden: true,
        },
      }
    )
  );
  return { onDidReceiveViewerMessage: provider.onDidReceiveViewerMessage };
}

export function deactivate(): void {}
