// Glue between the VS Code webview and the stock PDF.js viewer.
//
// Loaded as a classic script ahead of the PDF.js modules, so the error
// handlers are in place before anything else runs and the viewer can be
// configured from its "webviewerloaded" event, before it initialises.

"use strict";

(function () {
  const vscode = acquireVsCodeApi()

  function loadConfig() {
    const elem = document.getElementById('pdf-preview-config')
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'))
    }
    throw new Error('Could not load configuration.')
  }

  // Settings come from the user's (or the workspace's) configuration, which
  // VS Code does not validate against the schema, so map unknown values to
  // the defaults. Constants are PDF.js's CursorTool/ScrollMode/SpreadMode
  function cursorTool(name) {
    return name === 'hand' ? 1 : 0
  }
  function scrollMode(name) {
    switch (name) {
      case 'horizontal':
        return 1
      case 'wrapped':
        return 2
      default:
        return 0
    }
  }
  function spreadMode(name) {
    switch (name) {
      case 'odd':
        return 1
      case 'even':
        return 2
      default:
        return 0
    }
  }
  // `pdf-preview.default.scale` is a scale factor (1.0 = 100%) or a named
  // mode; PDF.js's defaultZoomValue wants a percentage or the same names
  function zoomValue(scale) {
    if (/^(auto|page-actual|page-fit|page-width)$/.test(scale)) {
      return scale
    }
    if (/^\d+(?:\.\d+)?$/.test(scale) && Number(scale) > 0) {
      return String(Math.round(Number(scale) * 10000) / 100)
    }
    return 'auto'
  }

  // --- Error reporting ------------------------------------------------------

  function describeError(err) {
    if (err instanceof Error) {
      return err.stack || `${err.name}: ${err.message}`
    }
    return String(err)
  }

  function reportError(kind, detail) {
    console.error(`[pdf-preview] ${kind}:`, detail)
    vscode.postMessage({ type: 'error', kind, detail })

    let panel = document.getElementById('pdf-preview-errors')
    if (!panel) {
      panel = document.createElement('section')
      panel.id = 'pdf-preview-errors'
      panel.setAttribute('role', 'alert')
      const header = document.createElement('header')
      const title = document.createElement('span')
      title.textContent = 'PDF preview error'
      const close = document.createElement('button')
      close.type = 'button'
      close.textContent = 'Dismiss'
      close.addEventListener('click', () => panel.remove())
      header.append(title, close)
      panel.append(header)
      ;(document.body || document.documentElement).append(panel)
    }
    const entry = document.createElement('div')
    entry.textContent = `${kind}\n${detail}`
    panel.append(entry)
  }

  window.addEventListener('error', function (event) {
    const target = event.target
    if (target && target !== window) {
      // Resource load failures (scripts, stylesheets, images) don't bubble,
      // hence the capture phase
      const url = target.src || target.href
      reportError('Failed to load resource', `${target.tagName} ${url}`)
    } else {
      const location = event.filename ? `\nat ${event.filename}:${event.lineno}:${event.colno}` : ''
      reportError('Uncaught error', (event.error ? describeError(event.error) : event.message) + location)
    }
  }, true)

  window.addEventListener('unhandledrejection', function (event) {
    reportError('Unhandled promise rejection', describeError(event.reason))
  })

  document.addEventListener('securitypolicyviolation', function (event) {
    reportError('Content Security Policy violation', `${event.effectiveDirective} blocked ${event.blockedURI || 'inline code'}`)
  })

  // --- Viewer setup ---------------------------------------------------------

  const config = loadConfig()

  // PDF.js dispatches "webviewerloaded" on the parent document when it can
  // reach it and on its own document otherwise; listen on both
  const eventTargets = new Set([document])
  try {
    eventTargets.add(parent.document)
  } catch {
    // Cross-origin parent
  }
  function onWebViewerLoaded(event) {
    if (event.detail?.source !== window) {
      return
    }
    for (const target of eventTargets) {
      target.removeEventListener('webviewerloaded', onWebViewerLoaded)
    }
    configureViewer()
  }
  for (const target of eventTargets) {
    target.addEventListener('webviewerloaded', onWebViewerLoaded)
  }

  // A cross-origin workerSrc makes PDF.js wrap it in a blob that does
  // `await import(workerSrc)`, and that import fails in a webview: resources
  // are served from a different origin than the webview document. The worker
  // bundle is self-contained, so run it from a same-origin blob URL instead
  async function createWorkerSrc(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: HTTP ${response.status}`)
    }
    const blob = new Blob([await response.arrayBuffer()], { type: 'text/javascript' })
    return URL.createObjectURL(blob)
  }

  function configureViewer() {
    const options = PDFViewerApplicationOptions
    // Only our settings apply; nothing is read from or kept in localStorage
    options.set('disablePreferences', true)
    options.set('disableHistory', true)
    // Don't open the PDF.js sample document; openDocument() does the opening
    options.set('defaultUrl', '')
    // Read-only viewer: no PDF JavaScript, no annotation editing
    options.set('enableScripting', false)
    options.set('annotationEditorMode', -1)

    // PDF.js resolves its default asset paths against the document, which is
    // wrong in a webview, so pass absolute webview URIs
    options.set('cMapUrl', config.cMapUrl)
    options.set('standardFontDataUrl', config.standardFontDataUrl)
    options.set('wasmUrl', config.wasmUrl)
    options.set('iccUrl', config.iccUrl)
    options.set('imageResourcesPath', config.imageResourcesPath)

    const defaults = config.defaults
    options.set('cursorToolOnLoad', cursorTool(defaults.cursor))
    options.set('scrollModeOnLoad', scrollMode(defaults.scrollMode))
    options.set('spreadModeOnLoad', spreadMode(defaults.spreadMode))
    options.set('sidebarViewOnLoad', defaults.sidebar === true ? 1 : 0)
    options.set('defaultZoomValue', zoomValue(defaults.scale))

    const workerSrc = createWorkerSrc(config.workerSrc)
    PDFViewerApplication.initializedPromise.then(async function () {
      const src = await workerSrc
      pdfjsLib.GlobalWorkerOptions.workerSrc = src
      options.set('workerSrc', src)
      start()
    }).catch(err => reportError('Failed to start the viewer', describeError(err)))
  }

  // --- Loading and reloading ------------------------------------------------

  // The most recent view, from the viewer's own events
  let lastLocation = null
  let lastSidebarView = null

  function start() {
    const { eventBus } = PDFViewerApplication
    eventBus.on('updateviewarea', ({ location }) => {
      lastLocation = location
    })
    eventBus.on('sidebarviewchanged', ({ view }) => {
      lastSidebarView = view
    })
    eventBus.on('documentloaded', () => {
      vscode.postMessage({ type: 'documentloaded' })
    })
    eventBus.on('pagerendered', ({ pageNumber, error }) => {
      if (error) {
        reportError(`Failed to render page ${pageNumber}`, describeError(error))
      } else {
        vscode.postMessage({ type: 'pagerendered', pageNumber })
      }
    })
    eventBus.on('documenterror', ({ message, reason }) => {
      reportError('Failed to load the document', reason ? `${message}\n${reason}` : message)
    })
    // A rebuilt document can have fewer pages than the one the saved view
    // points into. pagesinit fires after the page count is known but before
    // the viewer applies initialBookmark
    eventBus.on('pagesinit', clampInitialBookmark)

    // The extension host posts the file's bytes once we're ready, and again
    // whenever the file changes
    window.addEventListener('message', function (event) {
      const message = event.data
      switch (message?.type) {
        case 'load':
          if (message.data instanceof Uint8Array) {
            load(message.data)
          }
          break
        case 'readerror':
          reportError(`Failed to read ${config.fileName}`, String(message.detail))
          break
      }
    })
    vscode.postMessage({ type: 'ready' })
  }

  function clampInitialBookmark() {
    const bookmark = PDFViewerApplication.initialBookmark
    if (!bookmark) {
      return
    }
    const params = new URLSearchParams(bookmark)
    const pagesCount = PDFViewerApplication.pagesCount
    if (Number(params.get('page')) > pagesCount) {
      params.set('page', pagesCount)
      // The offsets belong to a page that no longer exists; keep the zoom
      const zoom = params.get('zoom')
      if (zoom) {
        params.set('zoom', zoom.split(',')[0])
      }
      PDFViewerApplication.initialBookmark = params.toString()
    }
  }

  function captureView() {
    const { pdfViewer } = PDFViewerApplication
    if (!PDFViewerApplication.pdfDocument || !lastLocation) {
      return null
    }
    return {
      // e.g. "page=3&zoom=page-width,-8,620", the same form as a URL hash
      bookmark: lastLocation.pdfOpenParams.replace(/^#/, ''),
      rotation: pdfViewer.pagesRotation,
      scrollMode: pdfViewer.scrollMode,
      spreadMode: pdfViewer.spreadMode,
      sidebarView: lastSidebarView,
    }
  }

  function applyView(view) {
    const options = PDFViewerApplicationOptions
    options.set('scrollModeOnLoad', view.scrollMode)
    options.set('spreadModeOnLoad', view.spreadMode)
    if (view.sidebarView !== null) {
      options.set('sidebarViewOnLoad', view.sidebarView)
    }
    // The viewer navigates to initialBookmark once the new document's pages
    // are laid out, and again after all pages loaded if their sizes differ
    PDFViewerApplication.initialBookmark = view.bookmark
    PDFViewerApplication.initialRotation = view.rotation
  }

  // A PDF ends with an %%EOF marker (ISO 32000-1, 7.5.5); a file that is
  // still being written usually doesn't have it yet
  function looksComplete(data) {
    const tail = new TextDecoder('latin1').decode(data.subarray(-1024))
    return tail.includes('%%EOF')
  }

  // Resolves once the viewer has applied the initial view, or failed
  function documentSettled() {
    const { eventBus } = PDFViewerApplication
    return new Promise(resolve => {
      const done = () => {
        eventBus.off('documentinit', done)
        eventBus.off('documenterror', done)
        resolve()
      }
      eventBus.on('documentinit', done)
      eventBus.on('documenterror', done)
    })
  }

  async function openDocument(data, view) {
    if (view) {
      if (!looksComplete(data)) {
        console.warn('[pdf-preview] Not reloading: the file looks incomplete')
        return
      }
      applyView(view)
    }
    const settled = documentSettled()
    await PDFViewerApplication.open({
      data,
      filename: config.fileName,
      // Fetch CMaps, standard fonts and WebAssembly decoders on the main
      // thread: requests the (blob URL) worker makes for webview resources
      // never complete, which leaves pages that need them blank
      useWorkerFetch: false,
    })
    await settled
  }

  // Loads are serialised: data that arrives while a load is running is kept
  // in pendingData (replacing older pending data), and opened afterwards, so
  // the last write wins. The view is captured once, before the first pass, as
  // later passes would otherwise capture a document that is still being laid
  // out. Without a document there is no view, and the data is opened as is
  let loading = false
  let pendingData = null

  async function load(data) {
    if (loading) {
      pendingData = data
      return
    }
    loading = true
    const view = captureView()
    try {
      while (data) {
        pendingData = null
        try {
          await openDocument(data, view)
        } catch (err) {
          if (view) {
            console.warn('[pdf-preview] Reload failed:', err)
          } else {
            reportError('Failed to open the document', describeError(err))
          }
        }
        data = pendingData
      }
    } finally {
      loading = false
    }
  }
}());
