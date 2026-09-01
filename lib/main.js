"use strict";

(function () {
  function loadConfig() {
    const elem = document.getElementById('pdf-preview-config')
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'))
    }
    throw new Error('Could not load configuration.')
  }
  function cursorTools(name) {
    if (name === 'hand') {
      return 1
    }
    return 0
  }
  function scrollMode(name) {
    switch (name) {
      case 'vertical':
        return 0
      case 'horizontal':
        return 1
      case 'wrapped':
        return 2
      default:
        return -1
    }
  }
  function spreadMode(name) {
    switch (name) {
      case 'none':
        return 0
      case 'odd':
        return 1
      case 'even':
        return 2
      default:
        return -1
    }
  }
  window.addEventListener('load', async function () {
    const config = loadConfig()
    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
    const loadOpts = {
      url:config.path,
      useWorkerFetch: false,
      cMapUrl: config.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: config.standardFontDataUrl
    }
    PDFViewerApplication.initializedPromise.then(() => {
      const defaults = config.defaults
      const optsOnLoad = () => {
        PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(defaults.cursor))
        PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale
        PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode)
        PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode)
        if (defaults.sidebar) {
          PDFViewerApplication.pdfSidebar.open()
        } else {
          PDFViewerApplication.pdfSidebar.close()
        }
        PDFViewerApplication.eventBus.off('documentloaded', optsOnLoad)
      }
      PDFViewerApplication.eventBus.on('documentloaded', optsOnLoad)
      
      // load() cannot be called before pdf.js is initialized
      // open() makes sure pdf.js is initialized before load()
      PDFViewerApplication.open(config.path).then(async function () {
        const doc = await pdfjsLib.getDocument(loadOpts).promise
        doc._pdfInfo.fingerprints = [config.path]
        PDFViewerApplication.load(doc)
      })
    })

    // Reload the document in place when the file on disk changes. pdf.js
    // itself restores the reading position: it saves page/zoom/scroll to
    // ViewHistory (localStorage) on every scroll, keyed by the document
    // fingerprint, and reads it back in load(). Reusing our stable
    // fingerprint (the file URI, set below) turns the reload into a restore.
    async function reloadDocument() {
      await PDFViewerApplication.initializedPromise
      const doc = await pdfjsLib.getDocument(loadOpts).promise
      // Changing the fingerprint fools pdf.js into keeping scroll position
      doc._pdfInfo.fingerprints = [config.path]

      // If the rebuilt PDF has fewer pages than the remembered position,
      // clamp it: scrollPageIntoView rejects out-of-range pages outright,
      // which would drop the reader back to page 1.
      try {
        if (PDFViewerApplication.store) {
          const page = parseInt(await PDFViewerApplication.store.get('page', '1'), 10)
          if (page > doc.numPages) {
            await PDFViewerApplication.store.set('page', doc.numPages)
          }
        }
      } catch (e) {
        // ViewHistory unavailable (e.g. localStorage blocked): position
        // restore cannot work there anyway; never let the clamp kill reloads.
      }

      // Prevents flickering of page when PDF is reloaded: like pdf.js'
      // _resetView, but keep the current page/scale/location so the view
      // does not jump through the default layout. _pages MUST be cleared:
      // setDocument() appends the new document's page views, and stale
      // entries would make the position restore (scrollPageIntoView) hit an
      // old, DOM-detached page view and silently do nothing.
      const pdfViewer = PDFViewerApplication.pdfViewer
      const oldResetView = pdfViewer._resetView
      pdfViewer._resetView = function () {
        this._pages = []
        this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)()
        this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)()
        this._pagesCapability = (0, pdfjsLib.createPromiseCapability)()
        if (this._onBeforeDraw) {
          this.eventBus._off('pagerender', this._onBeforeDraw)
          this._onBeforeDraw = null
        }
        if (this._onAfterDraw) {
          this.eventBus._off('pagerendered', this._onAfterDraw)
          this._onAfterDraw = null
        }

        this.viewer.textContent = ""
      }
      try {
        // _resetView is only called synchronously, from inside load(), so
        // the stub can be removed again as soon as load() returns.
        PDFViewerApplication.load(doc)
      } finally {
        pdfViewer._resetView = oldResetView
      }
    }

    // Run reloads strictly one at a time. A build rewrites the PDF several
    // times in quick succession; a message arriving mid-reload only marks
    // another pass, so the last write wins and _resetView can never be
    // captured while it is stubbed. A half-written PDF makes getDocument
    // reject; the view is kept and the write in progress fires another
    // change event that reloads again.
    let reloadRunning = false
    let reloadPending = false
    window.addEventListener('message', async function (event) {
      if (!event.data || event.data.type !== 'reload') {
        return
      }
      reloadPending = true
      if (reloadRunning) {
        return
      }
      reloadRunning = true
      try {
        while (reloadPending) {
          reloadPending = false
          try {
            await reloadDocument()
          } catch (error) {
            console.error('PDF preview reload failed: ' + error)
          }
        }
      } finally {
        reloadRunning = false
      }
    });
  }, { once: true });

  window.onerror = function () {
    const msg = document.createElement('body')
    msg.innerText = 'An error occurred while loading the file. Please open it again.'
    document.body = msg
  }
}());
