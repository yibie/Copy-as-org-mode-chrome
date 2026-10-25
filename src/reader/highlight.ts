/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Turning a selection in the Reader article into chai highlights.
 *
 * A highlight is one or more
 *   <mark data-chai-id="ID" data-chai-type="TYPE" data-chai-note="NOTE">
 * wrapping runs of text and whole inline elements (code, em, a, ...), never
 * part of a block, so the article's block structure is never changed.
 * html2org's normalizeChaiMarks() joins the pieces of one id on export.
 */

export interface HighlightSpec {
  type: string
  note: string
}

export type SelectionRejection = 'empty' | 'outside' | 'overlap' | 'unsupported' | 'crossesListItem'

const CHAI_MARK = 'mark[data-chai-type]'
/** Content a highlight may not contain or sit inside: images, tables, code blocks, media */
const UNSUPPORTED = 'img, picture, svg, video, audio, iframe, canvas, table, pre'

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
}

/** Why a range cannot be highlighted, or null when it can. */
export function checkHighlightRange(range: Range, articleEl: Element): SelectionRejection | null {
  if (range.collapsed || range.toString().trim() === '') { return 'empty' }
  if (!articleEl.contains(range.commonAncestorContainer)) { return 'outside' }

  const start = elementOf(range.startContainer)
  const end = elementOf(range.endContainer)
  const inside = (sel: string) => !!(start?.closest(sel) || end?.closest(sel))
  const intersects = (sel: string) =>
    Array.from(articleEl.querySelectorAll(sel)).some(el => range.intersectsNode(el))

  if (inside(CHAI_MARK) || intersects(CHAI_MARK)) { return 'overlap' }
  if (inside(UNSUPPORTED) || intersects(UNSUPPORTED)) { return 'unsupported' }
  // A CHAI block cannot sit between a paragraph and a list item, or between two items
  if ((start?.closest('li') ?? null) !== (end?.closest('li') ?? null)) { return 'crossesListItem' }
  return null
}

interface CoveredText {
  node: Text
  from: number
  to: number
}

/** The parts of text nodes the range covers that hold more than whitespace, in document order. */
function coveredTexts(range: Range): CoveredText[] {
  const { startContainer, startOffset, endContainer, endOffset } = range
  const root = range.commonAncestorContainer
  const nodes: Text[] = []
  if (root.nodeType === Node.TEXT_NODE) {
    nodes.push(root as Text)
  } else {
    const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (range.intersectsNode(n)) { nodes.push(n as Text) }
    }
  }
  return nodes.map(node => ({
    node,
    from: node === startContainer ? startOffset : 0,
    to: node === endContainer ? endOffset : node.length,
  })).filter(c => c.node.data.slice(c.from, c.to).trim() !== '')
}

/**
 * The range shrunk to the text it really covers, or null when it covers none.
 * A triple-click in Chrome ends the range at offset 0 of the next block, which
 * would otherwise make checkHighlightRange() look at the wrong block.
 */
export function tightenRange(range: Range): Range | null {
  const covered = coveredTexts(range)
  if (covered.length === 0) { return null }
  const first = covered[0]
  const last = covered[covered.length - 1]
  const out = range.startContainer.ownerDocument!.createRange()
  out.setStart(first.node, first.from)
  out.setEnd(last.node, last.to)
  return out
}

/** Elements a highlight piece may wrap whole; anything else counts as a block */
const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN', 'EM', 'I', 'INS', 'KBD',
  'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR',
])

function blockOf(node: Node): Element | null {
  let el = node.parentElement
  while (el && INLINE_TAGS.has(el.tagName)) { el = el.parentElement }
  return el
}

/**
 * Text nodes the range covers, with the partly covered ends split off. Whitespace-only
 * nodes are kept when their block also has covered text, so the highlight has no gaps
 * at the spaces around inline code or emphasis.
 */
function textNodesIn(range: Range): Text[] {
  const content = coveredTexts(range)
  const blocks = new Set(content.map(c => blockOf(c.node)))
  const nodes: Text[] = []
  const root = range.commonAncestorContainer
  if (root.nodeType === Node.TEXT_NODE) {
    nodes.push(root as Text)
  } else {
    const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (range.intersectsNode(n) && blocks.has(blockOf(n))) { nodes.push(n as Text) }
    }
  }
  return nodes.map(node => {
    let t = node
    const to = node === range.endContainer ? range.endOffset : node.length
    const from = node === range.startContainer ? range.startOffset : 0
    if (to < t.length) { t.splitText(to) }
    if (from > 0) { t = t.splitText(from) }
    return t
  }).filter(t => t.length > 0)
}

/**
 * The largest nodes to wrap: a text node is replaced by its inline ancestor when the
 * range covers all of that ancestor's text, so inline code is highlighted with its padding.
 */
function liftCovered(texts: Text[]): Node[] {
  const covered = new Set<Node>(texts)
  const fullyCovered = (el: Element) => {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n as Text).length > 0 && !covered.has(n)) { return false }
    }
    return true
  }
  const out: Node[] = []
  for (const text of texts) {
    let node: Node = text
    let parent = node.parentElement
    while (parent && INLINE_TAGS.has(parent.tagName) && fullyCovered(parent)) {
      node = parent
      parent = parent.parentElement
    }
    if (!out.includes(node) && !out.some(o => o.contains(node))) { out.push(node) }
  }
  return out
}

/** Consecutive siblings grouped, so each group becomes one mark. */
function siblingRuns(nodes: Node[]): Node[][] {
  const runs: Node[][] = []
  for (const node of nodes) {
    const run = runs[runs.length - 1]
    if (run && run[run.length - 1].nextSibling === node) { run.push(node) } else { runs.push([node]) }
  }
  return runs
}

/** Display-only note bubble after a highlight; articleHtmlForExport() removes it */
export const NOTE_BUBBLE_CLASS = 'caom-chai-note'

/**
 * Put a note bubble inside the mark; reader.css floats it above the highlight. The bubble is an empty element drawn from
 * data-note, so it adds no text that a selection or an export could pick up.
 */
export function addNoteBubble(mark: HTMLElement): HTMLElement | null {
  const note = mark.getAttribute('data-chai-note')
  if (!note) { return null }
  const bubble = mark.ownerDocument.createElement('span')
  bubble.className = NOTE_BUBBLE_CLASS
  bubble.setAttribute('data-note', note)
  bubble.setAttribute('data-chai-note-for', mark.getAttribute('data-chai-id') ?? '')
  bubble.setAttribute('contenteditable', 'false')
  mark.appendChild(bubble)
  return bubble
}

/** The note bubble of the highlight a node belongs to, if it has one. */
export function noteBubbleOf(node: Node | null): HTMLElement | null {
  const mark = node && (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)
    ?.closest('mark[data-chai-id]')
  if (!mark) { return null }
  const id = mark.getAttribute('data-chai-id')!
  return Array.from(mark.ownerDocument.querySelectorAll<HTMLElement>(`.${NOTE_BUBBLE_CLASS}`))
    .find(b => b.getAttribute('data-chai-note-for') === id) ?? null
}

let idCounter = 0
function newHighlightId(): string {
  idCounter++
  return `h${Date.now().toString(36)}${idCounter.toString(36)}`
}

/** Wrap the range in marks sharing one id; returns the marks (empty when nothing to wrap). */
export function wrapRange(range: Range, spec: HighlightSpec): HTMLElement[] {
  const doc = range.startContainer.ownerDocument!
  const id = newHighlightId()
  const note = spec.note.replace(/\s+/g, ' ').trim()
  return siblingRuns(liftCovered(textNodesIn(range))).map(run => {
    const mark = doc.createElement('mark')
    mark.setAttribute('data-chai-id', id)
    mark.setAttribute('data-chai-type', spec.type)
    if (note) { mark.setAttribute('data-chai-note', note) }
    run[0].parentNode!.insertBefore(mark, run[0])
    run.forEach(n => mark.appendChild(n))
    return mark
  })
}

/** The pieces of one highlight, in document order. */
export function highlightPieces(root: ParentNode, id: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('mark[data-chai-id]'))
    .filter(m => m.getAttribute('data-chai-id') === id)
}

function removeNoteBubble(pieces: HTMLElement[]): void {
  pieces.forEach(m => {
    m.querySelectorAll(`.${NOTE_BUBBLE_CLASS}`).forEach(b => b.remove())
    m.style.removeProperty('--caom-note-h')
    if (m.getAttribute('style') === '') { m.removeAttribute('style') }
  })
}

/** Change a highlight's type and note; returns its new note bubble, if it has a note. */
export function updateHighlight(root: ParentNode, id: string, spec: HighlightSpec): HTMLElement | null {
  const pieces = highlightPieces(root, id)
  if (pieces.length === 0) { return null }
  const note = spec.note.replace(/\s+/g, ' ').trim()
  removeNoteBubble(pieces)
  pieces.forEach(m => {
    m.setAttribute('data-chai-type', spec.type)
    if (note) { m.setAttribute('data-chai-note', note) } else { m.removeAttribute('data-chai-note') }
  })
  return addNoteBubble(pieces[pieces.length - 1])
}

/** Remove a highlight and its note, leaving the text as it was. */
export function removeHighlight(root: ParentNode, id: string): void {
  const pieces = highlightPieces(root, id)
  removeNoteBubble(pieces)
  pieces.forEach(m => {
    const parent = m.parentNode
    m.replaceWith(...Array.from(m.childNodes))
    parent?.normalize()
  })
}
