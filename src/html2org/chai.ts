/*
 * Chai highlight support.
 *
 * The Reader View marks highlights as
 *   <mark data-chai-id="ID" data-chai-type="TYPE" data-chai-note="NOTE">
 * and they are exported with the syntax of chai.el:
 *   [[chai:TYPE][TEXT]] or [[chai:TYPE:NOTE][TEXT]]
 * or, like chai does for text containing newlines,
 *   #+BEGIN_CHAI :type TYPE :note "NOTE"
 *   TEXT
 *   #+END_CHAI
 * Escaping mirrors Org's `org-link-make-string', which chai parses back intact.
 */

import { Rule } from './rules'
import { blockElements } from './utilities'

const ZWSP = '\u200b'
const CHAI_MARK = 'mark[data-chai-type]'
const TYPE_RE = /^[A-Za-z0-9_-]+$/
const BLOCK_SELECTOR = blockElements.join(',')

/** `org-link-escape': backslash-escape brackets, doubling backslashes before them or at the end. */
export function escapeLinkPath(path: string): string {
  return path.replace(/(\\*)([\[\]]|$)/g, (_m, bs: string, ch: string) => bs + bs + (ch ? '\\' + ch : ''))
}

/** Emacs `%S' string quoting, as chai uses for the block :note. */
function quoteElispString(s: string): string {
  return '"' + s.replace(/[\\"]/g, '\\$&') + '"'
}

/** Description escaping of `org-link-make-string': break up "]]" and a trailing "]". */
export function escapeLinkDescription(text: string): string {
  return text.replace(/\](?=\])/g, ']' + ZWSP).replace(/\]$/, ']' + ZWSP)
}

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}

function renameTo(el: Element, tagName: string): void {
  const renamed = el.ownerDocument.createElement(tagName)
  renamed.append(...Array.from(el.childNodes))
  el.replaceWith(renamed)
}

/**
 * Merge the fragments of each highlight into a single <mark>, so the rule
 * below never sees a split highlight. A selection crossing <em>/<a> or several
 * paragraphs is stored as several <mark>s sharing one data-chai-id; a Range
 * from the first to the last fragment re-wraps everything in between,
 * splitting the elements at both ends as needed.
 */
export function normalizeChaiMarks(root: Element): void {
  const groups = new Map<string, Element[]>()
  root.querySelectorAll(CHAI_MARK).forEach(m => {
    const id = m.getAttribute('data-chai-id')
    if (!id) return
    groups.set(id, [...(groups.get(id) || []), m])
  })
  groups.forEach(marks => {
    if (marks.length < 2) return
    const range = root.ownerDocument.createRange()
    range.setStartBefore(marks[0])
    range.setEndAfter(marks[marks.length - 1])
    const merged = marks[0].cloneNode(false) as Element
    merged.appendChild(range.extractContents())
    range.insertNode(merged)
  })
  // Fragments are now nested inside their merged <mark>.
  root.querySelectorAll(`${CHAI_MARK} ${CHAI_MARK}`).forEach(unwrap)
  root.querySelectorAll(CHAI_MARK).forEach(m => {
    if (m.querySelector(BLOCK_SELECTOR)) {
      // A heading line would end the #+BEGIN_CHAI block in Org.
      m.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => renameTo(h, 'p'))
    } else {
      // Org links can't nest.
      m.querySelectorAll('a').forEach(unwrap)
    }
  })
}

function chaiBlock(type: string, note: string, text: string): string {
  const header = '#+BEGIN_CHAI :type ' + type + (note ? ' :note ' + quoteElispString(note) : '')
  return `\n\n${header}\n${text}\n#+END_CHAI\n\n`
}

function chaiLink(type: string, note: string, text: string): string {
  const path = note ? `${type}:${escapeLinkPath(note)}` : type
  return `[[chai:${path}][${escapeLinkDescription(text)}]]`
}

export const chaiHighlightRule: Rule = {
  filter: node => node.nodeName === 'MARK' && TYPE_RE.test(node.getAttribute('data-chai-type') || ''),

  replacement: (content, node) => {
    const m = content.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    const [, leading, text, trailing] = m
    if (!text) return content
    const type = node.getAttribute('data-chai-type')!
    const note = (node.getAttribute('data-chai-note') || '').replace(/\s+/g, ' ').trim()
    // Same rule as chai's `chai--insert-highlight': text with newlines becomes a block.
    if (text.includes('\n')) return chaiBlock(type, note, text)
    return leading + chaiLink(type, note, text) + trailing
  }
}
