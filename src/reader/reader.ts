/*!
 * Copyright (c) 2021 ono ono (kuanyui) All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { storageManager, CopyAsOrgModeOptions } from '../options'
import { msgManager } from '../common'

declare global {
  interface Window {
    __caomReaderLoaded?: boolean
  }
}

let readerActive = false
let article: ReaderArticle | null = null
let opts: CopyAsOrgModeOptions | null = null

const FONT_STACKS: { [k in 'sans-serif' | 'serif']: string } = {
  'sans-serif': "ui-sans-serif, system-ui, -apple-system, sans-serif",
  'serif': "ui-serif, Georgia, 'Times New Roman', serif",
}

const ICON_MINUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>'
const ICON_NARROWER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 17-5-5 5-5"/><path d="m4 17 5-5-5-5"/></svg>'
const ICON_WIDER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/></svg>'
const ICON_LINES_TIGHT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="15" x2="20" y2="15"/></svg>'
const ICON_LINES_LOOSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>'
const ICON_SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>'
const ICON_TYPE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>'
const ICON_CHEVRONS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>'

interface ReaderArticle {
  title: string
  author: string
  published: string
  domain: string
  url: string
  contentHTML: string
  wordCount: number
}

// Idempotency guard + message listener
if (!window.__caomReaderLoaded) {
  window.__caomReaderLoaded = true
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'toggleReaderMode') {
      toggleReader()
      sendResponse({ ok: true })
    }
    return false
  })
}

function toggleReader(): void {
  if (readerActive) {
    window.location.reload()
    return
  }
  applyReader().catch(err => console.error('[copy-as-org-mode reader]', err))
}

async function applyReader(): Promise<void> {
  opts = await storageManager.getData()
  flattenShadowDom(document.body)

  // Clone + extract
  const docClone = document.cloneNode(true) as Document
  const defuddle = new window.Defuddle(docClone, {
    url: location.href,
    ...(opts.defuddleLanguage ? { language: opts.defuddleLanguage } : {}),
  })
  const result = await defuddle.parseAsync()

  // Fallback if extraction failed
  let contentHTML = result?.content
  if (!contentHTML) {
    const fallbackEl = document.querySelector('article') || document.body
    contentHTML = fallbackEl.innerHTML
  }

  // Build article object
  article = {
    title: result?.title || document.title,
    author: result?.author || '',
    published: result?.published || '',
    domain: result?.domain || location.hostname,
    url: location.href,
    contentHTML: contentHTML,
    wordCount: result?.wordCount ?? 0,
  }

  // Strip leading duplicate title
  stripDuplicateTitle()

  // Cleanup page
  cleanupPage()

  // Apply theme and CSS variables
  document.documentElement.classList.add('caom-reader-active')
  applyTheme(opts.readerTheme)
  const root = document.documentElement.style
  root.setProperty('--caom-font-size', `${opts.readerFontSize}px`)
  root.setProperty('--caom-line-width', `${opts.readerLineWidth}em`)
  root.setProperty('--caom-line-height', `${opts.readerLineHeight}`)
  root.setProperty('--caom-font-family', FONT_STACKS[opts.readerFontFamily])

  // Build UI
  buildReaderUI()

  // Populate article content
  populateArticleContent()

  // Build outline and toolbar
  const articleEl = document.querySelector('.caom-reader-article') as HTMLElement
  if (articleEl) {
    buildOutline(articleEl)
  }
  buildToolbar()

  readerActive = true
}

function flattenShadowDom(el: Element): void {
  try {
    const children = Array.from(el.children)
    for (const child of children) {
      if (child.shadowRoot) {
        const shadowClone = Array.from(child.shadowRoot.childNodes).map(n =>
          (n.cloneNode ? n.cloneNode(true) : n)
        )
        for (const clonedNode of shadowClone) {
          child.appendChild(clonedNode)
        }
      }
      flattenShadowDom(child)
    }
  } catch (e) {
    console.warn('[caom-reader] flattenShadowDom error:', e)
  }
}

function stripDuplicateTitle(): void {
  if (!article) return
  try {
    const parsed = new DOMParser().parseFromString(article.contentHTML, 'text/html')
    const titleText = article.title.trim().toLowerCase()
    const firstChild = parsed.body.firstElementChild
    if (firstChild && /^H[1-6]$/.test(firstChild.tagName)) {
      const elText = firstChild.textContent?.trim().toLowerCase() || ''
      if (elText === titleText) {
        firstChild.remove()
        article.contentHTML = parsed.body.innerHTML
      }
    }
  } catch (e) {
    console.warn('[caom-reader] stripDuplicateTitle error:', e)
  }
}

function cleanupPage(): void {
  // Brute-force clear timers
  try {
    let id = window.setTimeout(() => {}, 0) as unknown as number
    while (id--) {
      window.clearTimeout(id)
      window.clearInterval(id)
    }
  } catch (e) {}

  // Remove script elements except application/ld+json
  try {
    const scripts = Array.from(document.querySelectorAll('script:not([type="application/ld+json"])')).map(el => el)
    scripts.forEach(s => s.remove())
  } catch (e) {
    console.warn('[caom-reader] script removal error:', e)
  }

  // Replace body to drop event listeners
  try {
    const bodyClone = document.body.cloneNode(true)
    document.body.replaceWith(bodyClone)
  } catch (e) {
    console.warn('[caom-reader] body clone error:', e)
  }

  // Add CSP meta tag
  try {
    const cspMeta = document.createElement('meta')
    cspMeta.httpEquiv = 'Content-Security-Policy'
    cspMeta.content = "script-src 'none'; object-src 'none';"
    document.head.insertBefore(cspMeta, document.head.firstChild)
  } catch (e) {
    console.warn('[caom-reader] CSP meta error:', e)
  }

  // Remove stylesheets and styles except caom-reader-styles
  try {
    const links = Array.from(document.querySelectorAll('link[rel~="stylesheet"], link[as="style"]')).filter(
      l => l.id !== 'caom-reader-styles'
    )
    links.forEach(l => l.remove())
    const styles = Array.from(document.querySelectorAll('style')).filter(s => s.id !== 'caom-reader-styles')
    styles.forEach(s => s.remove())
  } catch (e) {
    console.warn('[caom-reader] stylesheet removal error:', e)
  }

  // Strip html and body attributes
  try {
    const htmlAttrs = Array.from(document.documentElement.attributes).map(a => a.name)
    for (const attr of htmlAttrs) {
      if (attr !== 'lang' && attr !== 'dir') {
        document.documentElement.removeAttribute(attr)
      }
    }
    const bodyAttrs = Array.from(document.body.attributes).map(a => a.name)
    for (const attr of bodyAttrs) {
      document.body.removeAttribute(attr)
    }
  } catch (e) {
    console.warn('[caom-reader] attribute stripping error:', e)
  }

  // Remove base elements
  try {
    Array.from(document.querySelectorAll('base')).forEach(b => b.remove())
  } catch (e) {
    console.warn('[caom-reader] base removal error:', e)
  }

  // Ensure charset and viewport
  try {
    let charsetFound = false
    let viewportFound = false
    for (const meta of Array.from(document.querySelectorAll('meta'))) {
      if (meta.getAttribute('charset')) charsetFound = true
      if (meta.getAttribute('name') === 'viewport') viewportFound = true
    }
    if (!charsetFound) {
      const charset = document.createElement('meta')
      charset.setAttribute('charset', 'UTF-8')
      document.head.insertBefore(charset, document.head.firstChild)
    }
    if (!viewportFound) {
      const viewport = document.createElement('meta')
      viewport.setAttribute('name', 'viewport')
      viewport.setAttribute('content', 'width=device-width, initial-scale=1')
      document.head.appendChild(viewport)
    }
  } catch (e) {
    console.warn('[caom-reader] meta tag error:', e)
  }

  // Add reader CSS link
  try {
    const styleLink = document.createElement('link')
    styleLink.id = 'caom-reader-styles'
    styleLink.rel = 'stylesheet'
    styleLink.href = chrome.runtime.getURL('dist/reader.css')
    document.head.appendChild(styleLink)
  } catch (e) {
    console.warn('[caom-reader] reader CSS link error:', e)
  }
}

function buildReaderUI(): void {
  document.body.replaceChildren()

  const container = document.createElement('div')
  container.className = 'caom-reader-container'

  // Sidebar left
  const sidebarLeft = document.createElement('div')
  sidebarLeft.className = 'caom-reader-sidebar'

  const outline = document.createElement('nav')
  outline.className = 'caom-reader-outline'
  sidebarLeft.appendChild(outline)

  container.appendChild(sidebarLeft)

  // Content
  const content = document.createElement('div')
  content.className = 'caom-reader-content'

  const main = document.createElement('main')

  const title = document.createElement('h1')
  title.className = 'caom-reader-title'
  title.textContent = article!.title
  main.appendChild(title)

  const meta = document.createElement('div')
  meta.className = 'caom-reader-meta'

  if (article!.author) {
    const authorSpan = document.createElement('span')
    authorSpan.textContent = article!.author
    meta.appendChild(authorSpan)
  }

  if (article!.published) {
    const date = new Date(article!.published)
    if (!isNaN(date.getTime())) {
      if (meta.childElementCount > 0) {
        const sep1 = document.createElement('span')
        sep1.textContent = ' · '
        meta.appendChild(sep1)
      }
      const dateSpan = document.createElement('span')
      dateSpan.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
      meta.appendChild(dateSpan)
    }
  }

  if (article!.domain) {
    if (meta.childElementCount > 0) {
      const sep2 = document.createElement('span')
      sep2.textContent = ' · '
      meta.appendChild(sep2)
    }
    const domainLink = document.createElement('a')
    domainLink.href = article!.url
    domainLink.target = '_blank'
    domainLink.rel = 'noopener'
    domainLink.textContent = article!.domain
    meta.appendChild(domainLink)
  }

  main.appendChild(meta)

  const articleEl = document.createElement('article')
  articleEl.className = 'caom-reader-article'
  main.appendChild(articleEl)

  content.appendChild(main)

  const footer = document.createElement('div')
  footer.className = 'caom-reader-footer'
  footer.textContent = `${article!.wordCount} words · copy-as-org-mode Reader`
  content.appendChild(footer)

  container.appendChild(content)

  // Sidebar right (spacer)
  const sidebarRight = document.createElement('div')
  sidebarRight.className = 'caom-reader-sidebar-right'
  container.appendChild(sidebarRight)

  document.body.appendChild(container)

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.className = 'caom-reader-toolbar'
  document.body.appendChild(toolbar)
}

function populateArticleContent(): void {
  if (!article) return
  const articleEl = document.querySelector('.caom-reader-article') as HTMLElement
  if (!articleEl) return

  try {
    const parsed = new DOMParser().parseFromString(article.contentHTML, 'text/html')
    Array.from(parsed.body.childNodes).forEach(n => articleEl.appendChild(document.adoptNode(n)))
  } catch (e) {
    console.warn('[caom-reader] content parsing error:', e)
  }

  // Post-process
  try {
    // Wrap tables
    Array.from(articleEl.querySelectorAll('table')).forEach(table => {
      const wrapper = document.createElement('div')
      wrapper.className = 'caom-table-wrapper'
      table.replaceWith(wrapper)
      wrapper.appendChild(table)
    })

    // Fix images with data-src
    Array.from(articleEl.querySelectorAll('img[data-src]')).forEach((img: any) => {
      if (!img.src || img.src.startsWith('data:image/')) {
        img.src = img.dataset.src
      }
    })

    // Assign ids to headings
    let headingIndex = 0
    Array.from(articleEl.querySelectorAll('h2, h3, h4, h5, h6')).forEach((h: any) => {
      if (!h.id) {
        h.id = `caom-h-${headingIndex}`
        headingIndex++
      }
    })
  } catch (e) {
    console.warn('[caom-reader] content post-processing error:', e)
  }
}

function buildOutline(articleEl: HTMLElement): void {
  const headings = Array.from(articleEl.querySelectorAll('h2:not(blockquote *), h3:not(blockquote *), h4:not(blockquote *), h5:not(blockquote *), h6:not(blockquote *)'))

  const sidebarLeft = document.querySelector('.caom-reader-sidebar') as HTMLElement
  const outline = document.querySelector('.caom-reader-outline') as HTMLElement

  if (headings.length < 2) {
    sidebarLeft.classList.add('caom-empty')
    return
  }

  // Add title item
  if (article) {
    const titleLink = document.createElement('a')
    titleLink.href = '#'
    titleLink.className = 'caom-outline-title'
    titleLink.textContent = article.title
    titleLink.addEventListener('click', e => {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    outline.appendChild(titleLink)
  }

  headings.forEach(h => {
    const a = document.createElement('a')
    a.href = `#${(h as HTMLElement).id || ''}`
    a.textContent = h.textContent
    a.className = `caom-outline-${h.tagName.toLowerCase()}`
    a.addEventListener('click', e => {
      e.preventDefault();
      (h as HTMLElement).scrollIntoView({ behavior: 'smooth' })
    })
    outline.appendChild(a)
  })

  // Track active heading
  const observer = new IntersectionObserver(
    entries => {
      let lastIntersecting: Element | null = null
      for (const entry of entries) {
        if (entry.isIntersecting) {
          lastIntersecting = entry.target
        }
      }
      if (lastIntersecting) {
        Array.from(outline.querySelectorAll('a')).forEach(link => {
          link.classList.remove('caom-active')
        })
        const activeLink = outline.querySelector(`a[href="#${(lastIntersecting as HTMLElement).id}"]`)
        if (activeLink) {
          activeLink.classList.add('caom-active')
        }
      }
    },
    { rootMargin: '-10% 0px -70% 0px' }
  )

  headings.forEach(h => observer.observe(h))
}

function makeSegPair(
  leftIcon: string, leftTitle: string, onLeft: () => void,
  rightIcon: string, rightTitle: string, onRight: () => void,
): HTMLElement {
  const div = document.createElement('div')
  div.className = 'caom-seg'

  const leftBtn = document.createElement('button')
  leftBtn.innerHTML = leftIcon
  leftBtn.title = leftTitle
  leftBtn.addEventListener('click', onLeft)
  div.appendChild(leftBtn)

  const rightBtn = document.createElement('button')
  rightBtn.innerHTML = rightIcon
  rightBtn.title = rightTitle
  rightBtn.addEventListener('click', onRight)
  div.appendChild(rightBtn)

  return div
}

function makeSelectPill(
  icon: string,
  options: { value: string, label: string }[],
  current: string,
  onChange: (v: string) => void,
): HTMLElement {
  const div = document.createElement('div')
  div.className = 'caom-select-pill'

  const iconSpan = document.createElement('span')
  iconSpan.className = 'caom-pill-icon'
  iconSpan.innerHTML = icon
  div.appendChild(iconSpan)

  const select = document.createElement('select')
  options.forEach(opt => {
    const option = document.createElement('option')
    option.value = opt.value
    option.textContent = opt.label
    if (opt.value === current) {
      option.selected = true
    }
    select.appendChild(option)
  })
  select.addEventListener('change', () => onChange(select.value))
  div.appendChild(select)

  const chevronSpan = document.createElement('span')
  chevronSpan.className = 'caom-pill-chevron'
  chevronSpan.innerHTML = ICON_CHEVRONS
  div.appendChild(chevronSpan)

  return div
}

function buildToolbar(): void {
  const toolbar = document.querySelector('.caom-reader-toolbar') as HTMLElement
  if (!toolbar || !opts) return

  toolbar.replaceChildren()

  // Org menu button
  const orgMenuButton = document.createElement('button')
  const img = document.createElement('img')
  img.src = chrome.runtime.getURL('img/icon.png')
  img.alt = 'Org-Mode actions'
  img.className = 'caom-toolbar-icon-img'
  orgMenuButton.appendChild(img)
  orgMenuButton.title = 'Org-Mode actions'
  toolbar.appendChild(orgMenuButton)

  // Settings button
  const settingsButton = document.createElement('button')
  settingsButton.textContent = 'Aa'
  settingsButton.title = 'Reader settings'
  toolbar.appendChild(settingsButton)

  // Exit button
  const exitButton = document.createElement('button')
  exitButton.textContent = '✕'
  exitButton.title = 'Exit Reader View'
  exitButton.addEventListener('click', () => {
    window.location.reload()
  })
  toolbar.appendChild(exitButton)

  // Create settings panel
  const panel = buildSettingsPanel()
  document.body.appendChild(panel)

  // Create org menu
  const menu = document.createElement('div')
  menu.className = 'caom-reader-menu caom-hidden'

  const copyOrgBtn = document.createElement('button')
  copyOrgBtn.textContent = 'Copy as Org-Mode'
  copyOrgBtn.addEventListener('click', () => {
    copyAsOrg()
    menu.classList.add('caom-hidden')
  })
  menu.appendChild(copyOrgBtn)

  const saveOrgBtn = document.createElement('button')
  saveOrgBtn.textContent = 'Save as Org-Mode'
  saveOrgBtn.addEventListener('click', () => {
    msgManager.sendToBg({ type: 'savePageAsOrg' })
    menu.classList.add('caom-hidden')
  })
  menu.appendChild(saveOrgBtn)

  const saveOrgFolderBtn = document.createElement('button')
  saveOrgFolderBtn.textContent = 'Save as Org-Mode (with images)'
  saveOrgFolderBtn.addEventListener('click', () => {
    msgManager.sendToBg({ type: 'savePageAsOrgFolder' })
    menu.classList.add('caom-hidden')
  })
  menu.appendChild(saveOrgFolderBtn)

  document.body.appendChild(menu)

  // Org menu button toggles menu
  orgMenuButton.addEventListener('click', () => {
    menu.classList.toggle('caom-hidden')
    panel.classList.add('caom-hidden')
  })

  // Settings button toggles panel
  settingsButton.addEventListener('click', () => {
    panel.classList.toggle('caom-hidden')
    menu.classList.add('caom-hidden')
  })

  // Close panel/menu when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!panel.contains(target) && target !== settingsButton &&
        !menu.contains(target) && target !== orgMenuButton && !target.closest('button')?.contains(img)) {
      panel.classList.add('caom-hidden')
      menu.classList.add('caom-hidden')
    }
  })

  // Scroll hide functionality
  let lastScrollY = window.scrollY
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null

  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      const scrollY = window.scrollY
      if (scrollY > lastScrollY + 4 && scrollY > 80) {
        // Scroll down
        toolbar.classList.add('caom-hidden')
        panel.classList.add('caom-hidden')
        menu.classList.add('caom-hidden')
      } else if (scrollY < lastScrollY - 4) {
        // Scroll up
        toolbar.classList.remove('caom-hidden')
      }
      lastScrollY = scrollY
    }, 0)
  }, { passive: true })

  // Escape key handling
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!menu.classList.contains('caom-hidden')) {
        // Close menu if open
        menu.classList.add('caom-hidden')
      } else if (!panel.classList.contains('caom-hidden')) {
        // Close panel if open
        panel.classList.add('caom-hidden')
      } else {
        // Exit reader
        window.location.reload()
      }
    }
  })
}

function buildSettingsPanel(): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'caom-reader-panel caom-hidden'

  if (!opts) return panel

  // Font size row
  const fontSizeRow = makeSegPair(
    ICON_MINUS, 'Decrease font size', () => {
      let v = opts!.readerFontSize
      v = Math.max(12, v - 1)
      opts!.readerFontSize = v
      document.documentElement.style.setProperty('--caom-font-size', `${v}px`)
      storageManager.setDataPartially({ readerFontSize: v })
    },
    ICON_PLUS, 'Increase font size', () => {
      let v = opts!.readerFontSize
      v = Math.min(28, v + 1)
      opts!.readerFontSize = v
      document.documentElement.style.setProperty('--caom-font-size', `${v}px`)
      storageManager.setDataPartially({ readerFontSize: v })
    }
  )
  panel.appendChild(fontSizeRow)

  // Line width row
  const lineWidthRow = makeSegPair(
    ICON_NARROWER, 'Narrower', () => {
      let v = opts!.readerLineWidth
      v = Math.max(28, v - 2)
      opts!.readerLineWidth = v
      document.documentElement.style.setProperty('--caom-line-width', `${v}em`)
      storageManager.setDataPartially({ readerLineWidth: v })
    },
    ICON_WIDER, 'Wider', () => {
      let v = opts!.readerLineWidth
      v = Math.min(64, v + 2)
      opts!.readerLineWidth = v
      document.documentElement.style.setProperty('--caom-line-width', `${v}em`)
      storageManager.setDataPartially({ readerLineWidth: v })
    }
  )
  panel.appendChild(lineWidthRow)

  // Line height row
  const lineHeightRow = makeSegPair(
    ICON_LINES_TIGHT, 'Decrease line height', () => {
      let v = opts!.readerLineHeight
      v = Math.max(1.2, v - 0.1)
      v = Math.round(v * 10) / 10
      opts!.readerLineHeight = v
      document.documentElement.style.setProperty('--caom-line-height', `${v}`)
      storageManager.setDataPartially({ readerLineHeight: v })
    },
    ICON_LINES_LOOSE, 'Increase line height', () => {
      let v = opts!.readerLineHeight
      v = Math.min(2.0, v + 0.1)
      v = Math.round(v * 10) / 10
      opts!.readerLineHeight = v
      document.documentElement.style.setProperty('--caom-line-height', `${v}`)
      storageManager.setDataPartially({ readerLineHeight: v })
    }
  )
  panel.appendChild(lineHeightRow)

  // Theme row
  const themeRow = makeSelectPill(
    ICON_SUN,
    [
      { value: 'auto', label: 'Auto' },
      { value: 'light', label: 'Light' },
      { value: 'sepia', label: 'Sepia' },
      { value: 'dark', label: 'Dark' },
    ],
    opts.readerTheme,
    (v) => {
      applyTheme(v as 'auto' | 'light' | 'sepia' | 'dark')
      opts!.readerTheme = v as 'auto' | 'light' | 'sepia' | 'dark'
      storageManager.setDataPartially({ readerTheme: v as 'auto' | 'light' | 'sepia' | 'dark' })
    }
  )
  panel.appendChild(themeRow)

  // Font family row
  const fontFamilyRow = makeSelectPill(
    ICON_TYPE,
    [
      { value: 'sans-serif', label: 'Sans-serif' },
      { value: 'serif', label: 'Serif' },
    ],
    opts.readerFontFamily,
    (v) => {
      opts!.readerFontFamily = v as 'sans-serif' | 'serif'
      document.documentElement.style.setProperty('--caom-font-family', FONT_STACKS[v as 'sans-serif' | 'serif'])
      storageManager.setDataPartially({ readerFontFamily: v as 'sans-serif' | 'serif' })
    }
  )
  panel.appendChild(fontFamilyRow)

  return panel
}

function applyTheme(theme: 'auto' | 'light' | 'sepia' | 'dark'): void {
  const html = document.documentElement
  html.classList.remove('caom-theme-light', 'caom-theme-sepia', 'caom-theme-dark')
  if (theme === 'light') {
    html.classList.add('caom-theme-light')
  } else if (theme === 'sepia') {
    html.classList.add('caom-theme-sepia')
  } else if (theme === 'dark') {
    html.classList.add('caom-theme-dark')
  }
}

function copyAsOrg(): void {
  if (!article || !opts) return

  if (!window.html2org) {
    msgManager.sendToBg({
      type: 'showBgNotification',
      title: 'Error',
      message: 'html2org not loaded',
    })
    return
  }

  try {
    // Build conversion options
    const conversionOptions = {
      unorderedListMarker: opts.ulBulletChar,
      orderedListMarker: opts.olBulletChar,
      codeDelimiter: opts.codeChar,
      listIndentSize: opts.listIndentSize,
      codeBlockStyle: opts.codeBlockStyle,
      decodeUri: opts.decodeUri,
      squareBracketsInLink: opts.squareBracketsInLink,
      ruby: opts.rubyHandleMethod,
      saveImages: false,
    }

    const orgBody = window.html2org.convert(article.contentHTML, conversionOptions)

    // Build org metadata header
    let header = `#+TITLE: ${article.title}\n`
    if (article.published) {
      const date = new Date(article.published)
      if (!isNaN(date.getTime())) {
        header += `#+DATE: ${date.toISOString()}\n`
      }
    }
    if (article.author) {
      header += `#+AUTHOR: ${article.author}\n`
    }
    header += `#+SOURCE_URL: ${article.url}\n\n`

    msgManager.sendToBg({
      type: 'copyStringToClipboard',
      org: header + orgBody,
    })
  } catch (err) {
    console.error('[caom-reader] copyAsOrg error:', err)
    msgManager.sendToBg({
      type: 'showBgNotification',
      title: 'Error',
      message: 'Copy as Org-Mode failed',
    })
  }
}
