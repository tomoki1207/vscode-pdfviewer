# pdf

Display pdf in VSCode.

![screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## Important notice
Because this issue([vscode#99906](https://github.com/microsoft/vscode/issues/99906)), you can't show extensions have extension.id like `*.pdf` (includes this extension) after install this extenstion.  
If you want to manage these, do it directly at pain where left of Extension View(`Cmd+Shift+x`).
![sample](https://user-images.githubusercontent.com/3643499/84976149-1e362e00-b162-11ea-950a-03061e38a83a.png)

## Contribute

### Upgrade PDF.js

1. Download latest [Prebuilt](https://mozilla.github.io/pdf.js/getting_started/#download).
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
