/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * The Reader View decorates the article DOM for display. Exports convert the
 * live article so highlights come along; articleHtmlForExport() undoes the
 * decorations that are display-only. The data-src image fix is kept on
 * purpose: in v1.5.0, saving from the Reader re-extracted the decorated page,
 * so saved images already used the fixed src.
 */

import { NOTE_BUBBLE_CLASS } from './highlight'

const TABLE_WRAPPER_CLASS = 'caom-table-wrapper'

export function decorateArticle(articleEl: HTMLElement): void {
  // Wrap tables
  Array.from(articleEl.querySelectorAll('table')).forEach(table => {
    const wrapper = articleEl.ownerDocument.createElement('div')
    wrapper.className = TABLE_WRAPPER_CLASS
    table.replaceWith(wrapper)
    wrapper.appendChild(table)
  })

  // Fix images with data-src
  Array.from(articleEl.querySelectorAll('img[data-src]')).forEach((img: any) => {
    if (!img.src || img.src.startsWith('data:image/')) {
      img.src = img.dataset.src
    }
  })

  // Assign ids to headings (html2org ignores ids, so exports need not undo this)
  let headingIndex = 0
  Array.from(articleEl.querySelectorAll('h2, h3, h4, h5, h6')).forEach((h: any) => {
    if (!h.id) {
      h.id = `caom-h-${headingIndex}`
      headingIndex++
    }
  })
}

/** HTML of the live article without display-only decorations; highlights are kept. */
export function articleHtmlForExport(articleEl: HTMLElement): string {
  const clone = articleEl.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`.${TABLE_WRAPPER_CLASS}`).forEach(w => w.replaceWith(...Array.from(w.childNodes)))
  clone.querySelectorAll(`.${NOTE_BUBBLE_CLASS}`).forEach(b => b.remove())
  return clone.innerHTML
}
