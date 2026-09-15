import * as assert from 'assert';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  degrees,
} from 'pdf-lib';
import { addHighlights } from '../../pdfAnnotations';

suite('PDF annotations', () => {
  test('adds highlight annotations with PDF page coordinates', async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 100]);
    source.addPage([400, 300]);

    const updated = await addHighlights(await source.save(), [
      { page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.4 },
      { page: 2, left: 0.25, top: 0.1, width: 0.5, height: 0.2 },
    ]);
    const document = await PDFDocument.load(updated);

    const firstPageAnnotations = document
      .getPage(0)
      .node.lookup(PDFName.of('Annots'), PDFArray);
    const secondPageAnnotations = document
      .getPage(1)
      .node.lookup(PDFName.of('Annots'), PDFArray);

    assert.strictEqual(firstPageAnnotations.size(), 1);
    assert.strictEqual(secondPageAnnotations.size(), 1);

    const annotation = document.context.lookup(
      firstPageAnnotations.get(0),
      PDFDict
    );
    assert.strictEqual(
      annotation.lookup(PDFName.of('Subtype'), PDFName).toString(),
      '/Highlight'
    );
    assert.deepStrictEqual(
      (annotation.get(PDFName.of('Rect')) as PDFArray)
        .asArray()
        .map(
          (value) => Math.round((value as PDFNumber).asNumber() * 1000) / 1000
        ),
      [20, 40, 80, 80]
    );
    assert.deepStrictEqual(
      (annotation.get(PDFName.of('QuadPoints')) as PDFArray)
        .asArray()
        .map(
          (value) => Math.round((value as PDFNumber).asNumber() * 1000) / 1000
        ),
      [20, 80, 80, 80, 20, 40, 80, 40]
    );
  });

  test('rejects rectangles outside the selected page', async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 100]);

    await assert.rejects(
      addHighlights(await source.save(), [
        { page: 2, left: 0, top: 0, width: 0.5, height: 0.5 },
      ]),
      /Invalid PDF highlight rectangle/
    );
    await assert.rejects(
      addHighlights(await source.save(), [
        { page: 1, left: 0.8, top: 0, width: 0.5, height: 0.5 },
      ]),
      /Invalid PDF highlight rectangle/
    );
  });

  test('accounts for page rotation when converting coordinates', async () => {
    const expectedRects = new Map([
      [0, [20, 40, 80, 80]],
      [90, [80, 10, 160, 40]],
      [180, [120, 40, 180, 80]],
      [270, [40, 60, 120, 90]],
    ]);

    for (const [rotation, expected] of expectedRects) {
      const source = await PDFDocument.create();
      const page = source.addPage([200, 100]);
      page.setRotation(degrees(rotation));

      const updated = await addHighlights(await source.save(), [
        { page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.4 },
      ]);
      const document = await PDFDocument.load(updated);
      const annotations = document
        .getPage(0)
        .node.lookup(PDFName.of('Annots'), PDFArray);
      const annotation = document.context.lookup(annotations.get(0), PDFDict);
      const rect = (annotation.get(PDFName.of('Rect')) as PDFArray)
        .asArray()
        .map(
          (value) => Math.round((value as PDFNumber).asNumber() * 1000) / 1000
        );

      assert.deepStrictEqual(rect, expected);
    }
  });
});
