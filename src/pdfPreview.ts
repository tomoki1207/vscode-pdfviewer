import * as vscode from 'vscode';
import { Disposable } from './disposable';

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, '&quot;');
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

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel,
    private readonly onViewerMessage: (message: ViewerMessage) => void
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
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
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this.render();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
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

    const config = vscode.workspace.getConfiguration('pdf-preview');
    const settings = {
      path: webview.asWebviewUri(this.resource).toString(),
      fileName: this.resource.path.split('/').pop(),
      workerSrc: libUri('build', 'pdf.worker.mjs'),
      cMapUrl: libDirUri('web', 'cmaps'),
      standardFontDataUrl: libDirUri('web', 'standard_fonts'),
      wasmUrl: libDirUri('web', 'wasm'),
      iccUrl: libDirUri('web', 'iccs'),
      imageResourcesPath: libDirUri('web', 'images'),
      defaults: {
        cursor: config.get('default.cursor') as string,
        scale: config.get('default.scale') as string,
        sidebar: config.get('default.sidebar') as boolean,
        scrollMode: config.get('default.scrollMode') as string,
        spreadMode: config.get('default.spreadMode') as string,
      },
    };

    // Use the stock viewer.html, so a PDF.js update needs no template diffing:
    // replace its CSP and point its relative references at webview URIs
    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(lib, 'web', 'viewer.html')
    );
    let html = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');

    const csp = [
      "default-src 'none'",
      // WebAssembly decoders for JPEG 2000 images and ICC colour profiles
      `script-src ${cspSource} 'wasm-unsafe-eval'`,
      `style-src ${cspSource} 'unsafe-inline'`,
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
<script src="${libUri('main.js')}"></script>`
    );
    html = replaceOnce(
      html,
      'href="locale/locale.json"',
      `href="${libUri('web', 'locale', 'locale.json')}"`
    );
    html = replaceOnce(
      html,
      'src="../build/pdf.mjs"',
      `src="${libUri('build', 'pdf.mjs')}"`
    );
    html = replaceOnce(
      html,
      'href="viewer.css"',
      `href="${libUri('web', 'viewer.css')}"`
    );
    html = replaceOnce(
      html,
      'src="viewer.mjs"',
      `src="${libUri('web', 'viewer.mjs')}"`
    );
    html = replaceOnce(
      html,
      '</head>',
      `<link rel="stylesheet" href="${libUri('pdf.css')}">\n</head>`
    );
    return html;
  }
}
