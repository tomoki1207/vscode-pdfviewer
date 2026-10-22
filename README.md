# PDF Viewer (PDF.js 6)

View PDF files in VS Code. A maintained continuation of [tomoki1207/vscode-pdfviewer](https://github.com/tomoki1207/vscode-pdfviewer) (`tomoki1207.pdf`), with an up-to-date [PDF.js](https://github.com/mozilla/pdf.js) and a locked-down webview.

## Features

- Opens `.pdf` files in a PDF.js 6 viewer: zoom, find, thumbnails, outline, attachments, layers, sticky notes, password-protected files, CJK text and JPEG 2000 images.
- **Auto-reload** when the file changes on disk, keeping the page, zoom, scroll position and sidebar. Made for LaTeX and Typst watch loops: rapid rebuilds end on the latest version, and half-written files are skipped.
- If the file is deleted and recreated shortly after (as many build tools do), the tab stays open and reloads.
- Links to `file.pdf#page=4`, `file.pdf#nameddest=intro` or `file.pdf#intro` open at that page or destination.
- Ctrl/Cmd+P, Ctrl/Cmd+Shift+P, Ctrl/Cmd+O and Ctrl/Cmd+S do what they do in the rest of VS Code (Quick Open, Command Palette and so on) instead of PDF.js's print, file picker and download.
- Works in untrusted workspaces and over Remote-SSH / WSL / containers (the extension runs locally).

Requires VS Code 1.123 or later, or the VSCodium release based on it.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pdf-preview.default.cursor` | `select` | Cursor tool on load: `select` or `hand`. |
| `pdf-preview.default.scale` | `auto` | Zoom on load: `auto`, `page-actual`, `page-fit`, `page-width`, or a scale factor (`1.25` = 125 %). |
| `pdf-preview.default.sidebar` | `false` | Show the sidebar on load. |
| `pdf-preview.default.scrollMode` | `vertical` | `vertical`, `horizontal` or `wrapped`. |
| `pdf-preview.default.spreadMode` | `none` | `none`, `odd` or `even`. |
| `pdf-preview.closeOnDeleteDelay` | `2000` | Milliseconds to wait before closing the tab when its file is deleted. `-1` keeps it open. |

Invalid values fall back to the next scope (workspace → user → default) and are reported once in the *PDF Preview* output channel.

## Switching from `tomoki1207.pdf`

Uninstall the old extension first. Both use the same `pdf-preview.*` settings, so your settings carry over, but VS Code can only register them for one extension at a time.

The editor ID changed from `pdf.preview` to `macromeer.pdfPreview`. If your `workbench.editorAssociations` setting maps `*.pdf` to `pdf.preview`, change it to `macromeer.pdfPreview`.

## Security

- PDF.js 6.4 is not affected by [CVE-2024-4367](https://codeanlabs.com/2024/05/cve-2024-4367-arbitrary-js-execution-in-pdf-js/) (arbitrary JavaScript through a crafted font), which affects the PDF.js 3.1 bundled in `tomoki1207.pdf` 1.2.2.
- PDF scripting and annotation editing are disabled.
- The webview has a strict Content Security Policy (nonce-only scripts, no inline scripts or styles) and can only read the extension's own files. The PDF is sent to it as bytes, so it has no access to the PDF's folder.
- Messages between the webview and the extension are validated, and so are settings, which matters in untrusted workspaces.

Please report security problems privately through [GitHub's security advisories](https://github.com/macromeer/pdf-viewer/security/advisories/new).

## Development

Needs Node.js 22 (see `.nvmrc`).

```bash
npm ci
npm run lint
npm test        # compiles, downloads VS Code and runs the integration tests
npm run package # builds the VSIX
```

Press F5 in VS Code to start an Extension Development Host.

### Updating PDF.js

```bash
scripts/update-pdfjs.sh <version> [sha256]
```

The script downloads the release, checks its SHA-256, replaces `lib/build` and `lib/web` and records the version in `lib/PDFJS_VERSION`. `lib/main.js` (the integration) and `lib/pdf.css` are not touched. A monthly workflow opens an issue with the exact command when a new PDF.js release is out. Run the tests afterwards; `src/pdfPreview.ts` fails loudly if `viewer.html` changed in a way it can't handle.

Releases are created automatically when a new version in `package.json` reaches `main`; the release notes come from `CHANGELOG.md`.

## History and credits

Originally written by [@tomoki1207](https://github.com/tomoki1207) (up to 1.2.2, 2022). Version 2.0.0 builds on ideas and fixes from pull requests to the original repository:

- [@cassandragargoyle](https://github.com/cassandragargoyle): PDF.js 6 port and release workflow (#209)
- [@DABH](https://github.com/DABH): root cause of the broken reloads, debouncing (#211)
- [@ricardofrantz](https://github.com/ricardofrantz): applying the sidebar default (#201)
- [@zamzterz](https://github.com/zamzterz): keeping the sidebar state across reloads (#122)
- [@jrandolf-old](https://github.com/jrandolf-old): keeping the tab open when a deleted file is recreated (#114)
- [@MStachowicz](https://github.com/MStachowicz): Ctrl+P opening the print dialog (#157)
- [@XV25](https://github.com/XV25): unreadable popup annotations (#181)
- [@przemech](https://github.com/przemech): jumping to named destinations (#140)
- [@saleemadnan](https://github.com/saleemadnan): escaping, `Uri.joinPath`, listener disposal (#199, #200)
- [@beedell-roke](https://github.com/beedell-roke): README fixes (#167)

See [CHANGELOG.md](CHANGELOG.md) for earlier contributors.

## License

MIT, see [LICENSE](LICENSE). The bundled PDF.js is licensed under the Apache License 2.0, see [lib/LICENSE](lib/LICENSE).
