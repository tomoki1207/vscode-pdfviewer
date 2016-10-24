PDFJS.getDocument(pdfPath).then(function (pdfDocument) {
  Promise.all(range(1, pdfDocument.numPages).map(function (pdfPageNum) {
    return pdfDocument.getPage(pdfPageNum).then(function (pdfPage) {
      var parent = document.getElementById('pdf-container');
      var viewport = pdfPage.getViewport(parent.offsetWidth / pdfPage.getViewport(1.0).width);
      var canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      var context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      pdfPage.render({ canvasContext: context, viewport: viewport });
      parent.appendChild(canvas);
    });
  }));
});

function range(start, end) {
  var range = [];
  for (var i = 0; i < end; ++i) {
    range[i] = start + i;
  }
  return range;
}