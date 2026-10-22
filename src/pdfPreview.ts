import * as vscode from 'vscode';
import { Disposable } from './disposable';
import { Settings } from './settings';

const ATTRIBUTE_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/[&<>"']/g, (c) => ATTRIBUTE_ESCAPES[c]);
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

// Replaces the single match of `search`, and throws if there is none, so a
// PDF.js update that changes viewer.html fails loudly instead of rendering a
// broken page
function replaceOnce(
  html: string,
  search: string | RegExp,
  replacement: string
): string {
  let found = false;
  const result = html.replace(search, () => {
    found = true;
    return replacement;
  });
  if (!found) {
    throw new Error(`viewer.html: ${search} not found`);
  }
  return result;
}

type PreviewState = 'Disposed' | 'Visible' | 'Active';

// Messages lib/main.js posts to the extension host
export type ViewerMessage =
  | { type: 'documentloaded' }
  | { type: 'pagerendered'; pageNumber: number }
  | { type: 'error'; kind: string; detail: string };

const MAX_ERROR_LENGTH = 4000;

// Build tools write the PDF in several bursts; reload once, after the last
const RELOAD_DEBOUNCE_MS = 250;

function parseViewerMessage(message: unknown): ViewerMessage | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const { type, pageNumber, kind, detail } = message as Record<string, unknown>;
  switch (type) {
    case 'documentloaded':
      return { type };
    case 'pagerendered':
      return Number.isInteger(pageNumber)
        ? { type, pageNumber: pageNumber as number }
        : undefined;
    case 'error':
      return {
        type,
        kind: String(kind).slice(0, MAX_ERROR_LENGTH),
        detail: String(detail).slice(0, MAX_ERROR_LENGTH),
      };
  }
  return undefined;
}

export class PdfPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';
  private _viewerReady = false;
  // Incremented per file read, so a slow read can't overwrite a newer one
  private _readGeneration = 0;
  private _reloadTimer: ReturnType<typeof setTimeout> | undefined;
  private _closeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly settings: Settings,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel,
    private readonly onViewerMessage: (message: ViewerMessage) => void
  ) {
    super();
    webviewEditor.webview.options = {
      enableScripts: true,
      // The PDF is posted to the webview as bytes, so it needs no access to
      // the PDF's folder, and works for remote and virtual file systems too
      localResourceRoots: [vscode.Uri.joinPath(extensionRoot, 'lib')],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        if (message?.type === 'ready') {
          this._viewerReady = true;
          this.sendDocument(true);
          return;
        }
        if (message?.type === 'reopen-as-text') {
          vscode.commands.executeCommand(
            'vscode.openWith',
            resource,
            'default',
            webviewEditor.viewColumn
          );
          return;
        }
        const viewerMessage = parseViewerMessage(message);
        if (viewerMessage) {
          this.onViewerMessage(viewerMessage);
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
      })
    );

    // A RelativePattern also watches files outside the workspace folders,
    // which a plain glob string does not
    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.joinPath(resource, '..'),
          resource.path.split('/').pop() ?? ''
        )
      )
    );
    const isResource = (uri: vscode.Uri): boolean =>
      uri.toString() === this.resource.toString();
    this._register(
      watcher.onDidChange((e) => {
        if (isResource(e)) {
          this.scheduleReload();
        }
      })
    );
    // Many build tools delete the file and write a new one
    this._register(
      watcher.onDidCreate((e) => {
        if (isResource(e)) {
          this.scheduleReload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (isResource(e)) {
          this.scheduleClose();
        }
      })
    );
    this._register({
      dispose: () => {
        clearTimeout(this._reloadTimer);
        clearTimeout(this._closeTimer);
      },
    });

    this.render();
    this.update();
  }

  private scheduleReload(): void {
    clearTimeout(this._closeTimer);
    this._closeTimer = undefined;
    clearTimeout(this._reloadTimer);
    this._reloadTimer = setTimeout(() => {
      this._reloadTimer = undefined;
      this.sendDocument(false);
    }, RELOAD_DEBOUNCE_MS);
  }

  // Closes the preview unless the file comes back within the grace period
  private scheduleClose(): void {
    clearTimeout(this._reloadTimer);
    this._reloadTimer = undefined;
    clearTimeout(this._closeTimer);
    this._closeTimer = undefined;
    // Milliseconds, or -1 to never close
    const delay = this.settings.get<number>('closeOnDeleteDelay');
    if (delay < 0) {
      return;
    }
    this._closeTimer = setTimeout(async () => {
      this._closeTimer = undefined;
      // The watcher can coalesce or drop events, so check before closing
      try {
        await vscode.workspace.fs.stat(this.resource);
        this.sendDocument(false);
      } catch {
        this.webviewEditor.dispose();
      }
    }, delay);
  }

  // Reads the file and posts its bytes to the viewer, which opens them on the
  // first load and reloads, keeping the current view, after that
  private async sendDocument(initial: boolean): Promise<void> {
    if (!this._viewerReady || this._previewState === 'Disposed') {
      return;
    }
    const generation = ++this._readGeneration;
    let data: Uint8Array;
    try {
      data = await vscode.workspace.fs.readFile(this.resource);
    } catch (err) {
      // A failed reload means the file is being rewritten or was deleted, and
      // the watcher reports what happens next
      if (initial && generation === this._readGeneration) {
        this.postMessage({ type: 'readerror', detail: String(err) });
      }
      return;
    }
    if (generation === this._readGeneration) {
      // readFile returns a Node Buffer, which VS Code would serialise as JSON.
      // A plain Uint8Array over the same memory is transferred as binary
      this.postMessage({
        type: 'load',
        data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      });
    }
  }

  private postMessage(message: unknown): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage(message);
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private async render(): Promise<void> {
    let html: string;
    try {
      html = await this.getWebviewContents();
    } catch (err) {
      this.onViewerMessage({
        type: 'error',
        kind: 'Failed to build the viewer page',
        detail: String(err),
      });
      return;
    }
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.html = html;
    }
  }

  private async getWebviewContents(): Promise<string> {
    const webview = this.webviewEditor.webview;
    const cspSource = webview.cspSource;
    const lib = vscode.Uri.joinPath(this.extensionRoot, 'lib');
    const libUri = (...p: string[]): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(lib, ...p)).toString();
    // PDF.js appends file names to these, so they need a trailing slash
    const libDirUri = (...p: string[]): string => `${libUri(...p)}/`;

    const settings = {
      fileName: this.resource.path.split('/').pop(),
      workerSrc: libUri('build', 'pdf.worker.mjs'),
      cMapUrl: libDirUri('web', 'cmaps'),
      standardFontDataUrl: libDirUri('web', 'standard_fonts'),
      wasmUrl: libDirUri('web', 'wasm'),
      iccUrl: libDirUri('web', 'iccs'),
      imageResourcesPath: libDirUri('web', 'images'),
      defaults: {
        cursor: this.settings.get<string>('default.cursor'),
        scale: this.settings.get<string>('default.scale'),
        sidebar: this.settings.get<boolean>('default.sidebar'),
        scrollMode: this.settings.get<string>('default.scrollMode'),
        spreadMode: this.settings.get<string>('default.spreadMode'),
      },
    };

    // Use the stock viewer.html, so a PDF.js update needs no template diffing:
    // replace its CSP and point its relative references at webview URIs
    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(lib, 'web', 'viewer.html')
    );
    let html = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');

    const nonce = createNonce();
    const csp = [
      "default-src 'none'",
      // WebAssembly decoders for JPEG 2000 images and ICC colour profiles.
      // Unlike 'unsafe-eval', 'wasm-unsafe-eval' allows no JavaScript eval
      `script-src 'nonce-${nonce}' 'wasm-unsafe-eval'`,
      // PDF.js only sets styles through the CSSOM, which CSP doesn't restrict
      `style-src ${cspSource}`,
      `img-src ${cspSource} blob: data:`,
      `font-src ${cspSource} blob: data:`,
      `connect-src ${cspSource}`,
      // lib/main.js runs the worker from a blob URL
      'worker-src blob:',
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
    // main.js goes first, ahead of the PDF.js modules; see the comment there
    html = replaceOnce(
      html,
      /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/,
      `<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta id="pdf-preview-config" data-config="${escapeAttribute(
        JSON.stringify(settings)
      )}">
<script src="${libUri('main.js')}" nonce="${nonce}"></script>`
    );
    html = replaceOnce(
      html,
      'href="locale/locale.json"',
      `href="${libUri('web', 'locale', 'locale.json')}"`
    );
    html = replaceOnce(
      html,
      'src="../build/pdf.mjs"',
      `src="${libUri('build', 'pdf.mjs')}" nonce="${nonce}"`
    );
    html = replaceOnce(
      html,
      'href="viewer.css"',
      `href="${libUri('web', 'viewer.css')}"`
    );
    html = replaceOnce(
      html,
      'src="viewer.mjs"',
      `src="${libUri('web', 'viewer.mjs')}" nonce="${nonce}"`
    );
    html = replaceOnce(
      html,
      '</head>',
      `<link rel="stylesheet" href="${libUri('pdf.css')}">\n</head>`
    );
    return html;
  }
}
