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
  // Dark page mode. Page and text colours are remapped while PDF.js paints the
  // canvas (see the `mapColor` hook in build/pdf.js): lightness is inverted and
  // squeezed into the range between DARK_BG and DARK_FG, hue and saturation are
  // kept. Raster images are painted through a different path and stay as-is.
  const DARK_BG = '#1e1e1e'
  const DARK_FG = '#d4d4d4'
  const DARK_BG_L = 0x1e / 255
  const DARK_FG_L = 0xd4 / 255
  const darkColorCache = new Map()
  function darkMapColor(r, g, b) {
    const key = (r << 16) | (g << 8) | b
    let color = darkColorCache.get(key)
    if (color === undefined) {
      const max = Math.max(r, g, b) / 255
      const min = Math.min(r, g, b) / 255
      const l = (max + min) / 2
      const d = max - min
      let h = 0
      let s = 0
      if (d > 0) {
        s = d / (1 - Math.abs(2 * l - 1))
        if (max === r / 255) {
          h = ((g - b) / 255 / d + 6) % 6
        } else if (max === g / 255) {
          h = (b - r) / 255 / d + 2
        } else {
          h = (r - g) / 255 / d + 4
        }
      }
      const newL = DARK_FG_L - l * (DARK_FG_L - DARK_BG_L)
      color = `hsl(${(h * 60).toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(newL * 100).toFixed(1)}%)`
      darkColorCache.set(key, color)
    }
    return color
  }
  const DARK_PAGE_COLORS = { background: DARK_BG, foreground: DARK_FG, mapColor: darkMapColor }

  function setDarkMode(enabled, rerender) {
    const app = PDFViewerApplication
    const pageColors = enabled ? DARK_PAGE_COLORS : null
    // New page/thumbnail views copy `pageColors` from their viewer;
    // existing ones read their own copy on every render.
    app.pdfViewer.pageColors = pageColors
    app.pdfThumbnailViewer.pageColors = pageColors
    document.body.classList.toggle('pdfDarkMode', enabled)
    const button = document.getElementById('darkModeToggle')
    button.classList.toggle('toggled', enabled)
    button.setAttribute('aria-pressed', enabled)
    if (!rerender) {
      return
    }
    for (const pageView of app.pdfViewer._pages) {
      pageView.pageColors = pageColors
    }
    for (const thumbnail of app.pdfThumbnailViewer._thumbnails) {
      thumbnail.pageColors = pageColors
      thumbnail.reset()
    }
    app.pdfViewer.refresh()
    app.forceRendering()
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
      let darkMode = !!defaults.darkMode
      setDarkMode(darkMode, false)
      document.getElementById('darkModeToggle').addEventListener('click', () => {
        darkMode = !darkMode
        setDarkMode(darkMode, true)
      })
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

    window.addEventListener('message', async function () {
      // Prevents flickering of page when PDF is reloaded
      const oldResetView = PDFViewerApplication.pdfViewer._resetView
      PDFViewerApplication.pdfViewer._resetView = function () {
        this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)()
        this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)()
        this._pagesCapability = (0, pdfjsLib.createPromiseCapability)()

        this.viewer.textContent = ""
      }

      // Changing the fingerprint fools pdf.js into keeping scroll position
      const doc = await pdfjsLib.getDocument(loadOpts).promise
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
