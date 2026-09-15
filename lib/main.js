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
  function base64ToBytes(value) {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  window.addEventListener('load', async function () {
    const config = loadConfig()

    // handle highlights (text annotations) in PDF:

    const vscode = acquireVsCodeApi()
    const highlightButton = document.getElementById('highlight')
    let pendingSelection = []
    const getSelectionRectangles = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return []
      }

      const range = selection.getRangeAt(0)
      const rectangles = []
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) {
          continue
        }
        const point = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        )
        const page = point && point.closest('.page')
        if (!page) {
          continue
        }
        const pageRect = page.getBoundingClientRect()
        rectangles.push({
          page: Number(page.dataset.pageNumber),
          left: Math.max(0, (rect.left - pageRect.left) / pageRect.width),
          top: Math.max(0, (rect.top - pageRect.top) / pageRect.height),
          width: Math.min(1, rect.width / pageRect.width),
          height: Math.min(1, rect.height / pageRect.height)
        })
      }
      return rectangles.filter(rectangle => Number.isInteger(rectangle.page) && rectangle.page > 0)
    }

    const showHighlight = rectangle => {
      const page = document.querySelector(`.page[data-page-number="${rectangle.page}"]`)
      if (!page) {
        return false
      }
      const overlay = document.createElement('div')
      overlay.className = 'pdf-preview-highlight-overlay'
      overlay.style.left = `${rectangle.left * 100}%`
      overlay.style.top = `${rectangle.top * 100}%`
      overlay.style.width = `${rectangle.width * 100}%`
      overlay.style.height = `${rectangle.height * 100}%`
      page.appendChild(overlay)
      return true
    }

    if (highlightButton) {
      document.addEventListener('mouseup', event => {
        if (event.target !== highlightButton) {
          const rectangles = getSelectionRectangles()
          if (rectangles.length > 0) {
            pendingSelection = rectangles
          }
        }
      })
      highlightButton.addEventListener('mousedown', event => {
        event.preventDefault()
        pendingSelection = getSelectionRectangles()
      })
      highlightButton.addEventListener('click', () => {
        const rectangles = pendingSelection.length > 0 ? pendingSelection : getSelectionRectangles()
        if (rectangles.length === 0) {
          vscode.postMessage({ type: 'highlight-error', message: 'Select some PDF text first.' })
          return
        }
        pendingSelection = []
        rectangles.forEach(showHighlight)
        vscode.postMessage({
          type: 'highlight',
          rectangles
        })
        window.getSelection().removeAllRanges()
      })
    }

    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
    const loadOpts = {
      url: config.path,
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

    window.addEventListener('message', async function (event) {
      if (!event.data || event.data.type !== 'reload') {
        return
      }

      // Prevents flickering of page when PDF is reloaded
      const oldResetView = PDFViewerApplication.pdfViewer._resetView
      PDFViewerApplication.pdfViewer._resetView = function () {
        this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)()
        this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)()
        this._pagesCapability = (0, pdfjsLib.createPromiseCapability)()

        this.viewer.textContent = ""
      }

      // Dirty custom-document bytes are sent by the extension host so reloads
      // do not fall back to the last saved file on disk.
      // Changing the fingerprint fools pdf.js into keeping scroll position
      const source = event.data.data
        ? { data: base64ToBytes(event.data.data) }
        : loadOpts
      const doc = await pdfjsLib.getDocument(source).promise
      doc._pdfInfo.fingerprints = [config.path]
      PDFViewerApplication.load(doc)

      PDFViewerApplication.pdfViewer._resetView = oldResetView
    });
  }, { once: true });

  window.onerror = function () {
    const msg = document.createElement('body')
    msg.innerText = 'An error occurred while loading the file. Please open it again.'
    document.body = msg
  }
}());
