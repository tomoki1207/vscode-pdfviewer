# pdf

Display pdf in VSCode. Fork of https://github.com/tomoki1207/vscode-pdfviewer .

![screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## Contribute

### Highlight PDF text

Select text in the PDF preview and click **Highlight** in the toolbar. The
selection is stored as a standard PDF highlight annotation and becomes part of
the document when you save it. Highlights can span multiple lines and pages;
the preview keeps unsaved highlights when it reloads. Annotation editing and
removal are not currently supported.

### Installing Extension locally & Developing any changes

After cloning this repo, run:

```bash
$ npm install            # creates node_modules/ folder
$ npm run compile        # creates out/ folder (compile TypeScript into JavaScript files)
$ npm test               # runs the automated extension tests
```

* Press `F5` to open a new VS Code window with this extension loaded.
* After making any changes to this extension, relaunch extension from debug toolbar, or else reload the opened VS Code window.

### Upgrade PDF.js

1. Download latest [Prebuilt(older browsers)](https://mozilla.github.io/pdf.js/getting_started/#download).
1. Extract the ZIP file.
1. Overwrite ./lib/* by extracted directories.
   - If lib/web/viewer.html has changes, apply these changes to HTML template at pdfPreview.ts.
1. To not use sample pdf.
  - Remove sample pdf called `compressed.tracemonkey-pldi-09.pdf`.
  - Remove code about using sample pdf from lib/web/viewer.js.
    ```js
    defaultUrl: {
      value: "", // "compressed.tracemonkey-pldi-09.pdf"
      kind: OptionKind.VIEWER
    },
    ```

## Change log
See [CHANGELOG.md](CHANGELOG.md).

## License
Please see [LICENSE](./LICENSE)
