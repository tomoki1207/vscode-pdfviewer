import * as assert from 'assert';
import * as vscode from 'vscode';
import { PdfCustomProvider } from '../../pdfProvider';

suite('PDF provider', () => {
  test('disposes tracked editor listeners', () => {
    const provider = new PdfCustomProvider(vscode.Uri.file('.'));
    let disposeCount = 0;
    const disposable: vscode.Disposable = {
      dispose: (): void => {
        disposeCount += 1;
      },
    };

    ((provider as unknown) as {
      _disposables: vscode.Disposable[];
    })._disposables.push(disposable);

    provider.dispose();
    provider.dispose();

    assert.strictEqual(disposeCount, 1);
  });
});
