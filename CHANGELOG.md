# Changelog

## 2.0.0 (2026/10/22)

First release of the maintained fork, published as `macromeer.pdf-viewer`. See the README for switching from `tomoki1207.pdf`.

### Security

- Update PDF.js from 3.1.81 to 6.4.299. Fixes [CVE-2024-4367](https://codeanlabs.com/2024/05/cve-2024-4367-arbitrary-js-execution-in-pdf-js/) (arbitrary JavaScript through a crafted font, fixed in PDF.js 4.2.67) and other parser bugs fixed since.
- Disable PDF scripting and annotation editing, and remove the scripting sandbox from the package.
- Strict Content Security Policy: scripts only with a per-load nonce, no `'unsafe-inline'` for scripts or styles.
- The webview can no longer read the PDF's folder; the PDF is sent to it as bytes.
- Validate messages from the webview and all settings (relevant in untrusted workspaces).
- Escape all special characters in HTML attributes.

### Changes

- **Breaking:** requires VS Code 1.123 or later.
- **Breaking:** the custom editor ID is now `macromeer.pdfPreview` (was `pdf.preview`). Update `workbench.editorAssociations` if you use it.
- Auto-reload rewritten: keeps page, zoom, scroll position and sidebar; rapid rebuilds end on the latest version; half-written files are skipped; file events are debounced.
- Auto-reload now also works for PDFs outside the workspace folders.
- New setting `pdf-preview.closeOnDeleteDelay`: when the file is deleted and recreated within this time (default 2 s), the tab stays open and reloads.
- `pdf-preview.default.*` settings are applied reliably, including the sidebar; `default.scale` values like `1.25` mean 125 %.
- Open links like `file.pdf#page=4` and `file.pdf#nameddest=intro` at that page or destination.
- Ctrl/Cmd+P, Ctrl/Cmd+Shift+P, Ctrl/Cmd+O and Ctrl/Cmd+S are left to VS Code instead of opening PDF.js's print dialog, file picker or download.
- Errors are shown in the viewer and logged to the new *PDF Preview* output channel.
- Removed the unused "reopen as text" message; use *Reopen Editor With…*.
- Toolchain: TypeScript 6, ESLint 10, `@vscode/vsce`, integration tests, CI and a monthly PDF.js update check.

### Thank you

- @cassandragargoyle PDF.js 6 port and release workflow (tomoki1207/vscode-pdfviewer#209)
- @DABH Root cause of the broken reloads, debouncing (tomoki1207/vscode-pdfviewer#211)
- @ricardofrantz Sidebar default (tomoki1207/vscode-pdfviewer#201)
- @zamzterz Sidebar state across reloads (tomoki1207/vscode-pdfviewer#122)
- @jrandolf-old Keep the tab open when a deleted file is recreated (tomoki1207/vscode-pdfviewer#114)
- @MStachowicz Ctrl+P opening the print dialog (tomoki1207/vscode-pdfviewer#157)
- @XV25 Popup annotation colours (tomoki1207/vscode-pdfviewer#181)
- @przemech Named destinations (tomoki1207/vscode-pdfviewer#140)
- @saleemadnan Escaping, `Uri.joinPath`, listener disposal (tomoki1207/vscode-pdfviewer#199, tomoki1207/vscode-pdfviewer#200)
- @beedell-roke README fixes (tomoki1207/vscode-pdfviewer#167)

## 1.2.2 (2022/12/23)

- Fix about rendering Unicode characters

## 1.2.1 (2022/12/12)

- Update PDF.js to 3.1.81-legacy
- Restore scroll position during reload (#136)
- Run under remote development (#100)

### Thank you

- @kfigiela Run extension locally when using remote development #100
- @Daniel-Atanasov fix: Fix scroll location and flickering during reload #136

## 1.2.0 (2021/12/15)

- Allow pdf viewer to work in an untrusted workspace (#102)
- Bump version of PDF.js to Stable (v2.10.377) (#120)

### Bug fixes

- Support Unicode in PDF by passing the right cMapUrl to pdf.js (#116)
- Preserve the current page number and zoom level on reload (#121)

### Thank you
- @lramos15 Added settings about untrusted workspaces. #102
- @aifreedom Fixed bug about Unicode charactors. #116
- @simon446 Bump pdf.js version. #120
- @zamzterz Fixed to preserve page number and scale on reload. #121

## 1.1.0 (2020/07/13)

- The issue about extension view is resolved.
  + Remove message shown on loaded. 
- Support default viewer settings
  + cursor (**hand** or tool)
  + scale (**auto**, page-actual, etc...)
  + sidebar (**hide** or show)
  + scrollMode (**vertical**, horizontal or wrapped)
  + spreadMode (**none**, odd or even)

## 1.0.0 (2020/06/18)

- [Change extension API](https://github.com/microsoft/vscode/issues/77131)
- Resolve known issues about showing pdf preview.
- Upgrade PDF.js to 2.4.456

## 0.6.0 (2020/04/10)

- Support auto reload (#52)
- Migrate vscode-extension packages

### Thank you
- @GeorchW Implemented auto-refresh ( #11 )  #52

## 0.5.0 (2019/02/25)

- Recovery for working even VSCode 1.31.x.
- Avoid nested `<iframe>`.

## 0.4.3 (2018/11/28)

- Recovery for working even VSCode 1.30.0.

## 0.4.2 (2018/11/28)

- Revive display state on load VSCode.
- [Event-Stream Package Security Update](https://code.visualstudio.com/blogs/2018/11/26/event-stream)

## 0.4.0 (2018/11/9)

- Migrate vscode internal api. Due to [Microsoft/vscode#62630](https://github.com/Microsoft/vscode/issues/62630)
- Upgrade PDF.js to 2.1.36

## 0.3.0 (2018/6/6)

- Upgrade PDF.js to 1.9.426 (#23)

### Thank you
- @Kampfgnom bump to pdf.js version #23

## 0.2.0 (2017/1/12)

- Fixed displaying on linux (#5)
- Be able to open PDF from context menu in explorer now (#6)

### Thank you
- @serl support for context menu in explorer #6

## 0.1.0 (2016/11/30)

- Add extension icon.
- Use all PDF.js [Pre-built](https://mozilla.github.io/pdf.js/getting_started/#download) files.

## 0.0.2 (2016/11/24)

- consistent file icon

## 0.0.1 (2016/10/25)

- Initial release.
