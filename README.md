# **PDF**

Displays PDF files in Visual Studio Code:

![Screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## **Contribute**

### **Upgrade PDF.js**

1.  Download the latest [prebuilt (for older browsers)](https://mozilla.github.io/pdf.js/getting_started/#download).
1.  Extract the ZIP file.
1.  Overwrite ./lib/* by extracted directories.
    1.  If `lib/web/viewer.html` has changed, apply these changes to the HTML template at pdfPreview.ts.
1.  To not use the sample PDF:
    1.  Remove the sample PDF called `compressed.tracemonkey-pldi-09.pdf`.
    1.  Remove code about using sample PDF from lib/web/viewer.js:
        ```JS
        defaultUrl: {
          value: "", // "compressed.tracemonkey-pldi-09.pdf"
          kind: OptionKind.VIEWER
        },
        ```

## **Changelog**

See the [`CHANGELOG.md`](./CHANGELOG.md).

## **License**

See the [`LICENSE`](./LICENSE)
