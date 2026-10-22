/*
 * Chai highlight support.
 *
 * The Reader View marks highlights as
 *   <mark data-chai-id="ID" data-chai-type="TYPE" data-chai-note="NOTE">
 * and they are exported with the link syntax of chai.el:
 *   [[chai:TYPE][TEXT]] or [[chai:TYPE:NOTE][TEXT]]
 * Escaping mirrors Org's `org-link-make-string', which chai parses back intact.
 */

import { Rule } from './rules'
import { isBlock } from './utilities'

const ZWSP = '​'
const CHAI_MARK = 'mark[data-chai-type]'
const TYPE_RE = /^[A-Za-z0-9_-]+$/

/** `org-link-escape': backslash-escape brackets, doubling backslashes before them or at the end. */
export function escapeLinkPath(path: string): string {
  return path.replace(/(\\*)([\[\]]|$)/g, (_m, bs: string, ch: string) => bs + bs + (ch ? '\\' + ch : ''))
}

/** Description escaping of `org-link-make-string': break up "]]" and a trailing "]". */
export function escapeLinkDescription(text: string): string {
  return text.replace(/\](?=\])/g, ']' + ZWSP).replace(/\]$/, ']' + ZWSP)
}

function blockAncestor(node: Node, root: Node): Node {
  let cur = node.parentNode
  while (cur && cur !== root && !isBlock(cur)) cur = cur.parentNode
  return cur || root
}

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}

/**
 * Merge the fragments of each highlight into a single <mark>, so the rule
 * below never sees a split highlight. A selection crossing <em>/<a> is stored
 * as several <mark>s sharing one data-chai-id; a Range from the first to the
 * last fragment re-wraps everything in between, splitting inline elements as
 * needed. Highlights spanning several blocks are left alone.
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
    const block = blockAncestor(marks[0], root)
    if (marks.some(m => blockAncestor(m, root) !== block)) return
    const range = root.ownerDocument.createRange()
    range.setStartBefore(marks[0])
    range.setEndAfter(marks[marks.length - 1])
    const merged = marks[0].cloneNode(false) as Element
    merged.appendChild(range.extractContents())
    range.insertNode(merged)
  })
  // Fragments are now nested inside their merged <mark>; org links can't nest either.
  root.querySelectorAll(`${CHAI_MARK} ${CHAI_MARK}, ${CHAI_MARK} a`).forEach(unwrap)
}

export const chaiHighlightRule: Rule = {
  filter: node => node.nodeName === 'MARK' && TYPE_RE.test(node.getAttribute('data-chai-type') || ''),

  replacement: (content, node) => {
    const m = content.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    const [, leading, text, trailing] = m
    if (!text) return content
    const type = node.getAttribute('data-chai-type')!
    const note = (node.getAttribute('data-chai-note') || '').replace(/\s+/g, ' ').trim()
    const path = note ? `${type}:${escapeLinkPath(note)}` : type
    return `${leading}[[chai:${path}][${escapeLinkDescription(text)}]]${trailing}`
  }
}
