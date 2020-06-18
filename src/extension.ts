import * as vscode from 'vscode';
import { PdfCustomProvider } from './pdfProvider';

export function activate(context: vscode.ExtensionContext): void {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  // Register our custom editor provider
  const provider = new PdfCustomProvider(extensionRoot);
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
  // show warning about extension view broken
  vscode.window
    .showInformationMessage(
      'You might not be able to show some extensions.',
      'More Info'
    )
    .then((v) => {
      if (v === 'More Info') {
        vscode.env.openExternal(
          vscode.Uri.parse(
            'https://github.com/tomoki1207/vscode-pdfviewer#important-notice'
          )
        );
      }
    });
}

export function deactivate(): void {}
