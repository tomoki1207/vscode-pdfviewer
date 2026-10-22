import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const fixtures = path.resolve(__dirname, '../../../src/test/fixtures');

suite('PDF preview', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('opens .pdf files in the pdf.preview custom editor', async () => {
    const uri = vscode.Uri.file(path.join(fixtures, 'sample.pdf'));
    await vscode.commands.executeCommand('vscode.open', uri);

    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    assert.ok(tab?.input instanceof vscode.TabInputCustom);
    assert.strictEqual(tab.input.viewType, 'pdf.preview');
    assert.strictEqual(tab.input.uri.toString(), uri.toString());
  });
});
