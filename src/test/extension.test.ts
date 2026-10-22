import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { PdfPreviewApi } from '../extension';
import type { ViewerMessage } from '../pdfPreview';
import { Settings } from '../settings';

const fixtures = path.resolve(__dirname, '../../../src/test/fixtures');

async function getApi(): Promise<PdfPreviewApi> {
  const extension = vscode.extensions.getExtension<PdfPreviewApi>(
    'macromeer.pdf-viewer'
  );
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

  test('opens .pdf files in the PDF Viewer custom editor', async () => {
    const uri = vscode.Uri.file(path.join(fixtures, 'sample.pdf'));
    await vscode.commands.executeCommand('vscode.open', uri);

    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    assert.ok(tab?.input instanceof vscode.TabInputCustom);
    assert.strictEqual(tab.input.viewType, 'macromeer.pdfPreview');
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

  test('opens at the location in the URI fragment', async () => {
    // At this zoom only one page is visible, so page 4 is only rendered if
    // the viewer went there
    const config = vscode.workspace.getConfiguration('pdf-preview');
    await config.update('default.scale', '3', true);
    try {
      const api = await getApi();
      const file = vscode.Uri.file(path.join(fixtures, 'pages.pdf'));
      for (const fragment of ['page=4', 'nameddest=intro', 'intro']) {
        const uri = file.with({ fragment });
        const rendered = pagesRendered(api, uri, [4]);
        await vscode.commands.executeCommand('vscode.open', uri);
        await rendered;
        await vscode.commands.executeCommand(
          'workbench.action.closeAllEditors'
        );
      }
    } finally {
      await config.update('default.scale', undefined, true);
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

  suite('settings', () => {
    const config = (): vscode.WorkspaceConfiguration =>
      vscode.workspace.getConfiguration('pdf-preview');
    const invalid: Record<string, unknown> = {
      'default.cursor': 'laser',
      'default.scale': '125%',
      'default.sidebar': 'yes',
      'default.scrollMode': ['wrapped'],
      'default.spreadMode': 42,
      closeOnDeleteDelay: 1.5,
    };

    function settings(): Settings {
      const extension = vscode.extensions.getExtension('macromeer.pdf-viewer');
      assert.ok(extension);
      return new Settings(extension.packageJSON);
    }

    teardown(async () => {
      for (const key of Object.keys(invalid)) {
        await config().update(key, undefined, true);
      }
    });

    test('uses valid values', async () => {
      await config().update('default.scale', '1.25', true);
      await config().update('closeOnDeleteDelay', -1, true);
      assert.strictEqual(settings().get('default.scale'), '1.25');
      assert.strictEqual(settings().get('closeOnDeleteDelay'), -1);
    });

    test('falls back to the defaults for invalid values', async () => {
      for (const [key, value] of Object.entries(invalid)) {
        await config().update(key, value, true);
      }
      const s = settings();
      for (const [key, value] of Object.entries(invalid)) {
        // VS Code stores the value as is
        assert.deepStrictEqual(config().inspect(key)?.globalValue, value, key);
        assert.strictEqual(
          s.get(key),
          config().inspect(key)?.defaultValue,
          key
        );
      }
    });

    test('renders with invalid values', async () => {
      for (const [key, value] of Object.entries(invalid)) {
        await config().update(key, value, true);
      }
      const api = await getApi();
      const uri = vscode.Uri.file(path.join(fixtures, 'sample.pdf'));
      await openAndWait(api, uri);
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
