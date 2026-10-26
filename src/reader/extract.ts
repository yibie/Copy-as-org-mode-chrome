/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Extraction for the Reader View overlay. It runs in the page and must not
 * change the page: the Reader no longer reloads the page on exit, so anything
 * touched here would stay touched.
 */

/** What the host page hands to the Reader frame */
export interface ReaderArticle {
  title: string
  author: string
  published: string
  domain: string
  url: string
  contentHTML: string
  wordCount: number
  keywords: string
}

/**
 * Clone the document, copying open shadow roots into the clone as light DOM so
 * the extractor sees their content. cloneNode() drops shadow roots.
 */
export function cloneDocumentWithShadow(doc: Document): Document {
  const clone = doc.cloneNode(true) as Document
  if (doc.documentElement && clone.documentElement) {
    copyShadowContent(doc.documentElement, clone.documentElement)
  }
  return clone
}

function copyShadowContent(orig: Element, copy: Element): void {
  // Pair the children before shadow content is appended to the copy
  const copyChildren = Array.from(copy.children)
  Array.from(orig.children).forEach((child, i) => {
    if (copyChildren[i]) copyShadowContent(child, copyChildren[i])
  })
  const root = orig.shadowRoot
  if (!root) return
  for (const node of Array.from(root.childNodes)) {
    const nodeClone = copy.ownerDocument.importNode(node, true)
    copy.appendChild(nodeClone)
    if (node.nodeType === Node.ELEMENT_NODE) copyShadowContent(node as Element, nodeClone as Element)
  }
}

const URL_ATTRS = ['src', 'href', 'poster', 'data-src']

/**
 * Resolve relative URLs against the page URL. The Reader frame is an extension
 * page, so relative URLs would otherwise resolve against the extension.
 * Fragment-only links stay as they are, so they keep scrolling in the Reader.
 */
export function absolutizeUrls(html: string, baseUrl: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const resolve = (value: string): string => {
    try {
      return new URL(value, baseUrl).href
    } catch (e) {
      return value
    }
  }
  for (const attr of URL_ATTRS) {
    doc.body.querySelectorAll(`[${attr}]`).forEach(el => {
      const value = el.getAttribute(attr)!.trim()
      if (value === '' || value.startsWith('#')) return
      el.setAttribute(attr, resolve(value))
    })
  }
  doc.body.querySelectorAll('[srcset]').forEach(el => {
    const srcset = el.getAttribute('srcset')!
      .split(',')
      .map(candidate => {
        const [url, ...descriptors] = candidate.trim().split(/\s+/)
        return url ? [resolve(url), ...descriptors].join(' ') : ''
      })
      .filter(Boolean)
      .join(', ')
    el.setAttribute('srcset', srcset)
  })
  return doc.body.innerHTML
}

/** Drop a leading heading that repeats the title; the Reader shows the title itself. */
export function stripDuplicateTitle(contentHTML: string, title: string): string {
  const parsed = new DOMParser().parseFromString(contentHTML, 'text/html')
  const firstChild = parsed.body.firstElementChild
  if (firstChild && /^H[1-6]$/.test(firstChild.tagName)) {
    const elText = firstChild.textContent?.trim().toLowerCase() || ''
    if (elText === title.trim().toLowerCase()) {
      firstChild.remove()
      return parsed.body.innerHTML
    }
  }
  return contentHTML
}
