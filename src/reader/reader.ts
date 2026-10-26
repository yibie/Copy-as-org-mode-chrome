/*!
 * Copyright (c) 2021 ono ono (kuanyui) All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { storageManager, CopyAsOrgModeOptions } from '../options'
import { msgManager, SavedPage } from '../common'
import { decorateArticle, articleHtmlForExport } from './article-dom'
import { addNoteBubble, checkHighlightRange, highlightPieces, removeHighlight, tightenRange, updateHighlight, wrapRange } from './highlight'
import { isValidChaiTypeName } from '../chai-types'
import { ReaderArticle } from './extract'
import TurndownService from '../html2org/turndown'

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

// The host page (reader-host.ts) extracts the article; this page shows it.
init().catch(err => {
  console.error('[copy-as-org-mode reader]', err)
  requestClose()
})

async function init(): Promise<void> {
  opts = await storageManager.getData()
  const res = await msgManager.sendToBg({ type: 'getReaderArticle' }) as { article: ReaderArticle | null } | undefined
  article = res?.article ?? null
  if (!article) throw new Error('No article from the host page')
  document.title = article.title

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
    installLinkHandling(articleEl)
  }
  buildToolbar()
  if (articleEl) {
    installHighlighting(articleEl)
  }

  window.parent.postMessage({ type: 'caom-reader-ready' }, '*')
}

/** Ask the host page to remove the overlay; the page is not reloaded. */
function requestClose(): void {
  window.parent.postMessage({ type: 'caom-reader-close' }, '*')
}

// This page is an extension page inside the overlay: links open in a new tab,
// and fragment links scroll the Reader.
function installLinkHandling(articleEl: HTMLElement): void {
  articleEl.addEventListener('click', (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return
    const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null
    if (!a) return
    e.preventDefault()
    const href = a.getAttribute('href')!
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1))
      const target = document.getElementById(id) || document.getElementsByName(id)[0]
      target?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    window.open(a.href, '_blank', 'noopener')
  })
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
    decorateArticle(articleEl)
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
    requestClose()
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
    saveAsOrg(false)
    menu.classList.add('caom-hidden')
  })
  menu.appendChild(saveOrgBtn)

  const saveOrgFolderBtn = document.createElement('button')
  saveOrgFolderBtn.textContent = 'Save as Org-Mode (with images)'
  saveOrgFolderBtn.addEventListener('click', () => {
    saveAsOrg(true)
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
        requestClose()
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

// Convert the live article so highlights are included
function convertArticle(saveImages: boolean): { org: string, extractedImages: SavedPage['extractedImages'] } {
  if (!article || !opts) throw new Error('Reader not active')
  const extractedImages: SavedPage['extractedImages'] = []
  const conversionOptions = {
    unorderedListMarker: opts.ulBulletChar,
    orderedListMarker: opts.olBulletChar,
    codeDelimiter: opts.codeChar,
    listIndentSize: opts.listIndentSize,
    codeBlockStyle: opts.codeBlockStyle,
    decodeUri: opts.decodeUri,
    squareBracketsInLink: opts.squareBracketsInLink,
    ruby: opts.rubyHandleMethod,
    saveImages,
    // html2org fills extractedImages while converting
    ...(saveImages ? { imagePathPrefix: opts.imagePathPrefix, extractedImages } : {}),
  }
  const articleEl = document.querySelector('.caom-reader-article') as HTMLElement | null
  const contentHTML = articleEl ? articleHtmlForExport(articleEl) : article.contentHTML
  return { org: new TurndownService(conversionOptions).turndown(contentHTML), extractedImages }
}

function copyAsOrg(): void {
  if (!article || !opts) return

  try {
    const orgBody = convertArticle(false).org

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

    const org = header + orgBody
    if (copyInFrame(org)) {
      msgManager.sendToBg({ type: 'showBgNotification', title: 'Org-Mode Text Copied Successfully!', message: org })
    } else {
      msgManager.sendToBg({ type: 'copyStringToClipboard', org })
    }
  } catch (err) {
    console.error('[caom-reader] copyAsOrg error:', err)
    msgManager.sendToBg({
      type: 'showBgNotification',
      title: 'Error',
      message: 'Copy as Org-Mode failed',
    })
  }
}

// Copy here: the background copies in the page, which would take the focus
// away from the Reader frame.
function copyInFrame(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch (e) {
    return false
  } finally {
    textarea.remove()
  }
}

// Hand the converted article to the background, which would otherwise
// re-extract the page and lose the highlights.
function saveAsOrg(withImages: boolean): void {
  if (!article || !opts) return

  try {
    const { org, extractedImages } = convertArticle(withImages)
    const page: SavedPage = {
      title: article.title,
      content: org,
      url: article.url,
      author: article.author,
      keywords: article.keywords,
      extractedImages,
    }
    if (withImages) {
      msgManager.sendToBg({ type: 'savePageAsOrgFolder', page })
    } else {
      msgManager.sendToBg({ type: 'savePageAsOrg', page })
    }
  } catch (err) {
    console.error('[caom-reader] saveAsOrg error:', err)
    msgManager.sendToBg({
      type: 'showBgNotification',
      title: 'Error',
      message: 'Save as Org-Mode failed',
    })
  }
}

// ==================================
// Highlighting
// ==================================

let hlMenu: HTMLElement | null = null
let hlNoteInput: HTMLInputElement | null = null
let hlCustomInput: HTMLInputElement | null = null
let hlDeleteBtn: HTMLButtonElement | null = null
let hlArticle: HTMLElement | null = null
/** The selection the open menu acts on; inputs in the menu take the focus and clear the live selection */
let pendingRange: Range | null = null
/** The highlight the open menu edits, when it was opened by clicking a highlight */
let editingId: string | null = null

function installHighlighting(articleEl: HTMLElement): void {
  hlArticle = articleEl
  applyHighlightColors()
  hlMenu = buildHighlightMenu()
  document.body.appendChild(hlMenu)

  document.addEventListener('mousedown', (e: MouseEvent) => {
    if (!hlMenu!.contains(e.target as Node)) hideHighlightMenu()
  })
  document.addEventListener('mouseup', (e: MouseEvent) => {
    // Only selections made in the article; not clicks on the toolbar or panels
    if (!articleEl.contains(e.target as Node)) return
    const target = e.target as Element
    // Let the selection settle after the click
    setTimeout(() => maybeShowHighlightMenu(articleEl, target), 0)
  })
  // Capture phase, so Esc closes the menu before the toolbar's handler exits the Reader
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !hlMenu!.classList.contains('caom-hidden')) {
      hideHighlightMenu()
      e.stopImmediatePropagation()
    }
  }, true)
  // The menu is placed once, in viewport coordinates
  window.addEventListener('scroll', () => hideHighlightMenu(), { passive: true })
}

function applyHighlightColors(): void {
  if (!opts) return
  // Names and colors are validated (chai-types.ts), so they are safe in CSS
  const css = opts.chaiTypes
    .map(t => `html.caom-reader-active .caom-reader-article mark[data-chai-type][data-chai-type="${t.name}"] { background: ${t.color}; }`)
    .join('\n')
  // An extension page: no page CSP to block an inline style here
  const style = document.createElement('style')
  style.id = 'caom-hl-colors'
  style.textContent = css
  document.head.appendChild(style)
}

function buildHighlightMenu(): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'caom-hl-menu caom-hidden'

  const types = document.createElement('div')
  types.className = 'caom-hl-types'
  for (const t of opts?.chaiTypes ?? []) {
    const btn = document.createElement('button')
    btn.className = 'caom-hl-type'
    btn.textContent = t.name
    btn.style.background = t.color
    btn.addEventListener('click', () => applyHighlight(t.name))
    types.appendChild(btn)
  }
  menu.appendChild(types)

  hlNoteInput = document.createElement('input')
  hlNoteInput.type = 'text'
  hlNoteInput.className = 'caom-hl-input'
  hlNoteInput.placeholder = 'Note (optional)'
  // Editing a highlight: Enter keeps its type and saves the note
  hlNoteInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !editingId) return
    e.preventDefault()
    const type = highlightPieces(hlArticle!, editingId)[0]?.getAttribute('data-chai-type')
    if (type) applyHighlight(type)
  })
  menu.appendChild(hlNoteInput)

  hlCustomInput = document.createElement('input')
  hlCustomInput.type = 'text'
  hlCustomInput.className = 'caom-hl-input'
  hlCustomInput.placeholder = 'Custom type, then Enter'
  hlCustomInput.addEventListener('input', () => {
    const v = hlCustomInput!.value.trim()
    hlCustomInput!.classList.toggle('caom-hl-invalid', v !== '' && !isValidChaiTypeName(v))
  })
  hlCustomInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = hlCustomInput!.value.trim()
    if (isValidChaiTypeName(v)) applyHighlight(v)
  })
  menu.appendChild(hlCustomInput)

  hlDeleteBtn = document.createElement('button')
  hlDeleteBtn.className = 'caom-hl-delete'
  hlDeleteBtn.textContent = 'Remove highlight'
  hlDeleteBtn.addEventListener('click', () => {
    if (editingId) removeHighlight(hlArticle!, editingId)
    hideHighlightMenu()
  })
  menu.appendChild(hlDeleteBtn)

  return menu
}

function maybeShowHighlightMenu(articleEl: HTMLElement, target: Element): void {
  const sel = window.getSelection()
  // A click (no selection) on a highlight opens the menu to edit it
  if (!sel || sel.isCollapsed) {
    const mark = target.closest?.('mark[data-chai-id]')
    if (mark && articleEl.contains(mark)) showEditMenu(mark.getAttribute('data-chai-id')!)
    return
  }
  const range = tightenRange(sel.getRangeAt(0))
  if (!range || checkHighlightRange(range, articleEl) !== null) return
  pendingRange = range
  setMenuMode(null)
  showHighlightMenuAt(range.getBoundingClientRect())
}

function showEditMenu(id: string): void {
  const pieces = highlightPieces(hlArticle!, id)
  if (pieces.length === 0) return
  setMenuMode(id)
  hlNoteInput!.value = pieces[0].getAttribute('data-chai-note') ?? ''
  const rect = pieces[pieces.length - 1].getBoundingClientRect()
  showHighlightMenuAt(rect)
}

/** Create mode (null) or edit mode for one highlight: marks its type and shows Remove */
function setMenuMode(id: string | null): void {
  editingId = id
  const type = id ? highlightPieces(hlArticle!, id)[0]?.getAttribute('data-chai-type') : null
  hlMenu!.querySelectorAll('.caom-hl-type').forEach(b => {
    b.classList.toggle('caom-hl-current', b.textContent === type)
  })
  hlDeleteBtn!.classList.toggle('caom-hidden', !id)
}

function showHighlightMenuAt(rect: DOMRect): void {
  if (!hlMenu) return
  hlMenu.classList.remove('caom-hidden')
  const gap = 8
  const w = hlMenu.offsetWidth
  const h = hlMenu.offsetHeight
  // Below the selection, or above it when there is no room
  let top = rect.bottom + gap
  if (top + h > window.innerHeight - gap) top = Math.max(gap, rect.top - h - gap)
  const left = Math.min(Math.max(gap, rect.left), window.innerWidth - w - gap)
  hlMenu.style.top = `${top}px`
  hlMenu.style.left = `${left}px`
}

function hideHighlightMenu(): void {
  if (!hlMenu || hlMenu.classList.contains('caom-hidden')) return
  hlMenu.classList.add('caom-hidden')
  hlNoteInput!.value = ''
  hlCustomInput!.value = ''
  hlCustomInput!.classList.remove('caom-hl-invalid')
  pendingRange = null
  editingId = null
}

function applyHighlight(type: string): void {
  const note = hlNoteInput?.value ?? ''
  let last: HTMLElement | undefined
  let bubble: HTMLElement | null = null
  if (editingId) {
    bubble = updateHighlight(hlArticle!, editingId, { type, note })
    const pieces = highlightPieces(hlArticle!, editingId)
    last = pieces[pieces.length - 1]
  } else {
    if (!pendingRange) return
    const marks = wrapRange(pendingRange, { type, note })
    // The note bubble follows the last piece only
    last = marks[marks.length - 1]
    bubble = last ? addNoteBubble(last) : null
  }
  // reader.css reserves this height above the line, so only that line grows
  if (bubble && last) last.style.setProperty('--caom-note-h', `${bubble.offsetHeight}px`)
  window.getSelection()?.removeAllRanges()
  hideHighlightMenu()
}
