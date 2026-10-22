import * as vscode from 'vscode';
import { PdfCustomProvider, ViewerMessageEvent } from './pdfProvider';
import { Settings } from './settings';

export interface PdfPreviewApi {
  // Used by the integration tests to observe the viewer
  readonly onDidReceiveViewerMessage: vscode.Event<ViewerMessageEvent>;
}

export function activate(context: vscode.ExtensionContext): PdfPreviewApi {
  const log = vscode.window.createOutputChannel('PDF Preview', { log: true });
  // Register our custom editor provider
  const settings = new Settings(context.extension.packageJSON, log);
  const provider = new PdfCustomProvider(context.extensionUri, settings);
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
