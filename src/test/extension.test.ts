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

// A new document, not just another render of the current one
function reloaded(api: PdfPreviewApi, uri: vscode.Uri): Promise<void> {
  let loaded = false;
  return waitForViewer(api, uri, (m) => {
    loaded ||= m.type === 'documentloaded';
    return loaded && m.type === 'pagerendered' && m.pageNumber === 1;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findTab(uri: vscode.Uri): vscode.Tab | undefined {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .find(
      (tab) =>
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.uri.toString() === uri.toString()
    );
}

// Counts the documents the viewer of `uri` opens until disposed
function countLoads(
  api: PdfPreviewApi,
  uri: vscode.Uri
): { readonly count: number; dispose(): void } {
  let count = 0;
  const listener = api.onDidReceiveViewerMessage(({ uri: from, message }) => {
    if (
      from.toString() === uri.toString() &&
      message.type === 'documentloaded'
    ) {
      count++;
    }
  });
  return {
    get count() {
      return count;
    },
    dispose: () => listener.dispose(),
  };
}

// Runs `body` with a copy of sample.pdf in a temporary folder
async function withTempPdf(
  body: (file: string, uri: vscode.Uri) => Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-preview-'));
  const file = path.join(dir, 'temp.pdf');
  fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
  try {
    await body(file, vscode.Uri.file(file));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function openAndWait(api: PdfPreviewApi, uri: vscode.Uri): Promise<void> {
  const rendered = pagesRendered(api, uri, [1]);
  await vscode.commands.executeCommand('vscode.open', uri);
  await rendered;
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
    // Small enough for all three pages to be visible, and so rendered. The
    // sidebar adds thumbnails, which have to get past the CSP too
    const config = vscode.workspace.getConfiguration('pdf-preview');
    await config.update('default.scale', '0.2', true);
    await config.update('default.sidebar', true, true);
    try {
      const api = await getApi();
      const uri = vscode.Uri.file(path.join(fixtures, 'features.pdf'));
      const rendered = pagesRendered(api, uri, [1, 2, 3]);
      await vscode.commands.executeCommand('vscode.open', uri);
      await rendered;
    } finally {
      await config.update('default.scale', undefined, true);
      await config.update('default.sidebar', undefined, true);
    }
  });

  test('reloads when the file changes', async () => {
    const api = await getApi();
    await withTempPdf(async (file, uri) => {
      await openAndWait(api, uri);

      const reload = reloaded(api, uri);
      fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
      await reload;
    });
  });

  test('reloads once for a burst of writes', async () => {
    const api = await getApi();
    await withTempPdf(async (file, uri) => {
      await openAndWait(api, uri);

      const loads = countLoads(api, uri);
      try {
        const reload = reloaded(api, uri);
        for (let i = 0; i < 5; i++) {
          fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
          await delay(30);
        }
        await reload;
        await delay(1000);
        assert.strictEqual(loads.count, 1);
      } finally {
        loads.dispose();
      }
    });
  });

  suite('when the file is deleted', () => {
    const config = (): vscode.WorkspaceConfiguration =>
      vscode.workspace.getConfiguration('pdf-preview');

    setup(async () => {
      await config().update('closeOnDeleteDelay', 500, true);
    });
    teardown(async () => {
      await config().update('closeOnDeleteDelay', undefined, true);
    });

    test('closes the preview after the grace period', async () => {
      const api = await getApi();
      await withTempPdf(async (file, uri) => {
        await openAndWait(api, uri);
        fs.rmSync(file);
        await delay(100);
        assert.ok(findTab(uri), 'closed before the grace period ended');
        for (let i = 0; i < 50 && findTab(uri); i++) {
          await delay(100);
        }
        assert.strictEqual(findTab(uri), undefined);
      });
    });

    test('keeps the preview open and reloads if the file comes back', async () => {
      const api = await getApi();
      await withTempPdf(async (file, uri) => {
        await openAndWait(api, uri);
        const reload = reloaded(api, uri);
        fs.rmSync(file);
        await delay(100);
        fs.copyFileSync(path.join(fixtures, 'sample.pdf'), file);
        await reload;
        await delay(1000);
        assert.ok(findTab(uri));
      });
    });
  });
});
