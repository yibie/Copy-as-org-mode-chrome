/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Reader View host, injected into the page's top frame. It extracts the article
 * and shows the Reader (dist/reader.html) in a full-viewport iframe overlay. The
 * page itself is left alone, so exiting removes the overlay instead of
 * reloading. See
 * .phrase/phases/DONE-phase-reader-highlight-20261021/DONE-ADR-reader-iframe-overlay_20261024.md.
 */

import { storageManager } from '../options'
import { msgManager } from '../common'
import { absolutizeUrls, cloneDocumentWithShadow, ReaderArticle, stripDuplicateTitle } from './extract'

declare global {
  interface Window {
    __caomReaderHostLoaded?: boolean
  }
}

const READY_TIMEOUT_MS = 5000
/** Fallback when transitionend does not fire, e.g. in a background tab */
const CLOSE_TIMEOUT_MS = 400

// Styles live in the overlay's shadow root as a constructed sheet: the page's
// CSS cannot reach it and the page's CSP does not govern it.
const OVERLAY_CSS = `
.backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.25);
  opacity: 0;
  transition: opacity 220ms ease;
}
.sheet {
  position: fixed; inset: 0;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 220ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.open .backdrop { opacity: 1; }
.open .sheet { opacity: 1; transform: none; }
iframe { display: block; width: 100%; height: 100%; border: 0; margin: 0; padding: 0; }
@media (prefers-reduced-motion: reduce) {
  .backdrop, .sheet { transition: none; }
}
`

// Inline !important on the host element beats the page's own !important rules
const HOST_STYLE: [string, string][] = [
  ['all', 'initial'],
  ['position', 'fixed'],
  ['inset', '0'],
  ['width', 'auto'],
  ['height', 'auto'],
  ['max-width', 'none'],
  ['max-height', 'none'],
  ['margin', '0'],
  ['padding', '0'],
  ['border', '0'],
  ['background', 'transparent'],
  ['overflow', 'hidden'],
  ['display', 'block'],
  ['z-index', '2147483647'],
]

interface Overlay {
  host: HTMLElement
  wrapper: HTMLElement
  sheet: HTMLElement
  frame: HTMLIFrameElement
  readyTimer: number
  /** The Reader frame has rendered and handles exit requests itself */
  ready: boolean
  /** The page's inline overflow on <html>, restored on close */
  savedOverflow: [string, string]
}

let article: ReaderArticle | null = null
let overlay: Overlay | null = null
let opening = false
let closing = false

if (!window.__caomReaderHostLoaded) {
  window.__caomReaderHostLoaded = true
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'toggleReaderMode') {
      toggleReader()
      sendResponse({ ok: true })
    } else if (msg && msg.type === 'getReaderArticle') {
      // Relayed by the background from the Reader frame
      sendResponse({ article })
    }
    return false
  })
  window.addEventListener('message', onFrameMessage, true)
}

function toggleReader(): void {
  if (overlay && overlay.ready) {
    // The Reader confirms first when highlights would be lost, then asks to close
    overlay.frame.focus()
    overlay.frame.contentWindow?.postMessage({ type: 'caom-reader-exit' }, new URL(chrome.runtime.getURL('')).origin)
  } else if (overlay) {
    closeReader()
  } else if (!opening) {
    opening = true
    openReader()
      .catch(err => {
        console.error('[copy-as-org-mode reader]', err)
        notify('Failed to open Reader View')
      })
      .finally(() => { opening = false })
  }
}

async function openReader(): Promise<void> {
  const opts = await storageManager.getData()
  const defuddle = new window.Defuddle(cloneDocumentWithShadow(document), {
    url: location.href,
    ...(opts.defuddleLanguage ? { language: opts.defuddleLanguage } : {}),
  })
  const result = await defuddle.parseAsync()

  let contentHTML = result?.content
  if (!contentHTML) {
    const fallbackEl = document.querySelector('article') || document.body
    contentHTML = fallbackEl.innerHTML
  }
  const title = result?.title || document.title
  const metaContent = (name: string) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || ''

  article = {
    title,
    author: result?.author || metaContent('author'),
    published: result?.published || '',
    domain: result?.domain || location.hostname,
    url: location.href,
    contentHTML: absolutizeUrls(stripDuplicateTitle(contentHTML, title), document.baseURI),
    wordCount: result?.wordCount ?? 0,
    keywords: metaContent('keywords'),
  }
  mountOverlay()
}

function mountOverlay(): void {
  const host = document.createElement('caom-reader-overlay')
  for (const [prop, value] of HOST_STYLE) host.style.setProperty(prop, value, 'important')
  host.setAttribute('popover', 'manual')

  const shadow = host.attachShadow({ mode: 'closed' })
  const css = new CSSStyleSheet()
  css.replaceSync(OVERLAY_CSS)
  shadow.adoptedStyleSheets = [css]

  const wrapper = document.createElement('div')
  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  const frame = document.createElement('iframe')
  frame.src = chrome.runtime.getURL('dist/reader.html')
  frame.title = 'Reader View'
  frame.setAttribute('allow', 'clipboard-write')
  sheet.appendChild(frame)
  wrapper.append(backdrop, sheet)
  shadow.appendChild(wrapper)

  const rootStyle = document.documentElement.style
  const savedOverflow: [string, string] = [rootStyle.getPropertyValue('overflow'), rootStyle.getPropertyPriority('overflow')]
  rootStyle.setProperty('overflow', 'hidden', 'important')

  const readyTimer = window.setTimeout(() => {
    teardown()
    notify('Reader View did not load')
  }, READY_TIMEOUT_MS)
  // Set before anything below can throw, so teardown() can undo it
  overlay = { host, wrapper, sheet, frame, readyTimer, ready: false, savedOverflow }

  // On <html>, not <body>: a transformed body would trap position: fixed
  document.documentElement.appendChild(host)
  // Top layer, above any z-index the page uses; the inline fixed position and
  // z-index cover the case without it
  const popover = host as HTMLElement & { showPopover?: () => void }
  try {
    if (typeof popover.showPopover === 'function') popover.showPopover()
  } catch (e) {
    console.warn('[caom-reader] showPopover failed:', e)
  }
}

// Messages from the Reader frame. The page cannot forge event.source, so only
// the frame can send these.
function onFrameMessage(e: MessageEvent): void {
  if (!overlay || e.source !== overlay.frame.contentWindow) return
  const type = e.data && e.data.type
  if (type === 'caom-reader-ready') {
    window.clearTimeout(overlay.readyTimer)
    overlay.ready = true
    const { wrapper, frame } = overlay
    // Next frame, so the closed state paints first and the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('open')))
    frame.focus()
  } else if (type === 'caom-reader-close') {
    closeReader()
  }
}

function closeReader(): void {
  if (!overlay || closing) return
  closing = true
  const { wrapper, sheet } = overlay
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !wrapper.classList.contains('open')) {
    teardown()
    return
  }
  const timer = window.setTimeout(teardown, CLOSE_TIMEOUT_MS)
  sheet.addEventListener('transitionend', () => {
    window.clearTimeout(timer)
    teardown()
  }, { once: true })
  wrapper.classList.remove('open')
}

function teardown(): void {
  if (!overlay) return
  const { host, readyTimer, savedOverflow } = overlay
  window.clearTimeout(readyTimer)
  host.remove()
  const rootStyle = document.documentElement.style
  if (savedOverflow[0]) {
    rootStyle.setProperty('overflow', savedOverflow[0], savedOverflow[1])
  } else {
    rootStyle.removeProperty('overflow')
  }
  overlay = null
  article = null
  closing = false
  window.focus()
}

function notify(message: string): void {
  msgManager.sendToBg({ type: 'showBgNotification', title: 'Copy as Org-Mode', message })
}
