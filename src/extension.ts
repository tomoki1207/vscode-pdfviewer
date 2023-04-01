import * as vscode from 'vscode';
import { PdfCustomProvider } from './pdfProvider';

export function activate(context: vscode.ExtensionContext) {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  let callbacks = []
  // Register our custom editor provider
  const provider = new PdfCustomProvider(extensionRoot, callbacks);
  context.subscriptions.push(
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

  return {
      registerOnClickCallback(callback: (contents: string) => any) {
        callbacks.push(callback)
      }
  }
}

export function deactivate(): void {}
