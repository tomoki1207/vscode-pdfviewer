import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { PdfPreviewApi } from '../extension';
import type { ViewerMessage } from '../pdfPreview';

const fixtures = path.resolve(__dirname, '../../../src/test/fixtures');

async function getApi(): Promise<PdfPreviewApi> {
  const extension =
    vscode.extensions.getExtension<PdfPreviewApi>('tomoki1207.pdf');
  assert.ok(extension);
  return extension.activate();
}

// Resolves once `done` returns true for a message the viewer of `uri` posts;
// rejects on any error it reports, or after `timeout` ms
function waitForViewer(
  api: PdfPreviewApi,
  uri: vscode.Uri,
  done: (message: ViewerMessage) => boolean,
  timeout = 15000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listener.dispose();
      reject(new Error('Timed out waiting for the viewer'));
    }, timeout);
    const listener = api.onDidReceiveViewerMessage(({ uri: from, message }) => {
      if (from.toString() !== uri.toString()) {
        return;
      }
      if (message.type === 'error') {
        clearTimeout(timer);
        listener.dispose();
        reject(new Error(`${message.kind}: ${message.detail}`));
      } else if (done(message)) {
        clearTimeout(timer);
        listener.dispose();
        resolve();
      }
    });
  });
}

function documentLoaded(api: PdfPreviewApi, uri: vscode.Uri): Promise<void> {
  return waitForViewer(api, uri, (m) => m.type === 'documentloaded');
}

function pagesRendered(
  api: PdfPreviewApi,
  uri: vscode.Uri,
  pages: number[]
): Promise<void> {
  const pending = new Set(pages);
  return waitForViewer(api, uri, (m) => {
    if (m.type === 'pagerendered') {
      pending.delete(m.pageNumber);
    }
    return pending.size === 0;
  });
}

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

  test('renders the document without errors', async () => {
    const api = await getApi();
    const uri = vscode.Uri.file(path.join(fixtures, 'sample.pdf'));
    const rendered = pagesRendered(api, uri, [1]);
    await vscode.commands.executeCommand('vscode.open', uri);
    await rendered;
  });

  test('renders CJK text, CMYK colours and JPEG 2000 images', async () => {
    // Small enough for all three pages to be visible, and so rendered
    const config = vscode.workspace.getConfiguration('pdf-preview');
    await config.update('default.scale', '0.2', true);
    try {
      const api = await getApi();
      const uri = vscode.Uri.file(path.join(fixtures, 'features.pdf'));
      const rendered = pagesRendered(api, uri, [1, 2, 3]);
      await vscode.commands.executeCommand('vscode.open', uri);
      await rendered;
    } finally {
      await config.update('default.scale', undefined, true);
    }
  });

  test('reloads when the file changes', async () => {
    const api = await getApi();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-preview-'));
    const file = path.join(dir, 'reload.pdf');
    fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
    const uri = vscode.Uri.file(file);
    try {
      const loaded = documentLoaded(api, uri);
      await vscode.commands.executeCommand('vscode.open', uri);
      await loaded;

      const reloaded = pagesRendered(api, uri, [1]);
      fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
      await reloaded;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
