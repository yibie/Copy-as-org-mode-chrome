import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { html2org } from '../src/html2org'
import { addNoteBubble, checkHighlightRange, highlightPieces, noteBubbleOf, removeHighlight, tightenRange, updateHighlight, wrapRange } from '../src/reader/highlight'
import { articleHtmlForExport } from '../src/reader/article-dom'

const convert = (html: string) => html2org.convert(html, {})

function article(html: string): HTMLElement {
  const el = document.createElement('article')
  el.innerHTML = html
  document.body.replaceChildren(el)
  return el
}

/** Range from the start of `from` to the end of `to` (first text nodes containing them). */
function select(root: Element, from: string, to: string): Range {
  const texts: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { texts.push(n as Text) }
  const s = texts.find(t => t.data.includes(from))!
  const e = texts.slice(texts.indexOf(s)).find(t => t.data.includes(to))!
  const range = document.createRange()
  range.setStart(s, s.data.indexOf(from))
  const toStart = s === e ? s.data.indexOf(to, s.data.indexOf(from)) : e.data.indexOf(to)
  range.setEnd(e, toStart + to.length)
  return range
}

const marks = (el: Element) => Array.from(el.querySelectorAll('mark'))

test('wraps part of one text node', () => {
  const el = article('<p>one two three</p>')
  const r = select(el, 'two', 'two')
  assert.equal(checkHighlightRange(r, el), null)
  wrapRange(r, { type: 'key', note: '' })
  assert.equal(convert(el.innerHTML), 'one [[chai:key][two]] three')
})

test('note is collapsed and stored; empty note is omitted', () => {
  const el = article('<p>one two three</p>')
  const [m] = wrapRange(select(el, 'two', 'two'), { type: 'idea', note: '  why\n not ' })
  assert.equal(m.getAttribute('data-chai-note'), 'why not')
  const el2 = article('<p>one two three</p>')
  const [m2] = wrapRange(select(el2, 'two', 'two'), { type: 'idea', note: '  ' })
  assert.equal(m2.hasAttribute('data-chai-note'), false)
})

test('selection across <em> and <a> gives pieces with one id, exported as one link', () => {
  const el = article('<p>a <em>b c</em> d <a href="https://e.com">e</a> f</p>')
  const r = select(el, 'c', 'e')
  assert.equal(checkHighlightRange(r, el), null)
  const ms = wrapRange(r, { type: 'key', note: 'n' })
  assert.ok(ms.length > 1)
  assert.equal(new Set(ms.map(m => m.getAttribute('data-chai-id'))).size, 1)
  assert.equal(el.querySelector('em')!.textContent, 'b c')
  assert.equal(el.querySelector('a')!.getAttribute('href'), 'https://e.com')
  assert.equal(el.textContent, 'a b c d e f')
  // Inline marks stay literal inside the link (task002); the double space is issue001
  assert.equal(convert(el.innerHTML), 'a /b/  [[chai:key:n][/c/ d e]] f')
})

test('selection across paragraphs is exported as a CHAI block', () => {
  const el = article('<p>one two</p>\n<p>three four</p>')
  const r = select(el, 'two', 'three')
  assert.equal(checkHighlightRange(r, el), null)
  const ms = wrapRange(r, { type: 'key', note: '' })
  assert.equal(ms.length, 2)  // the "\n" between paragraphs is not wrapped
  assert.equal(convert(el.innerHTML), 'one\n\n#+BEGIN_CHAI :type key\ntwo\n\nthree\n#+END_CHAI\n\nfour')
})

test('each highlight gets its own id', () => {
  const el = article('<p>one two three</p>')
  const [a] = wrapRange(select(el, 'one', 'one'), { type: 'key', note: '' })
  const [b] = wrapRange(select(el, 'three', 'three'), { type: 'key', note: '' })
  assert.notEqual(a.getAttribute('data-chai-id'), b.getAttribute('data-chai-id'))
})

test('rejects empty and whitespace-only selections', () => {
  const el = article('<p>one   two</p>')
  const t = el.querySelector('p')!.firstChild as Text
  const r = document.createRange()
  r.setStart(t, 1); r.setEnd(t, 1)
  assert.equal(checkHighlightRange(r, el), 'empty')
  r.setStart(t, 3); r.setEnd(t, 6)
  assert.equal(checkHighlightRange(r, el), 'empty')
})

test('rejects selections outside the article', () => {
  const el = article('<p>inside</p>')
  const outside = document.createElement('div')
  outside.textContent = 'outside text'
  document.body.appendChild(outside)
  assert.equal(checkHighlightRange(select(document.body, 'inside', 'outside'), el), 'outside')
})

test('rejects overlap with an existing highlight, inside or around it', () => {
  const el = article('<p>one two three four</p>')
  wrapRange(select(el, 'two', 'three'), { type: 'key', note: '' })
  assert.equal(checkHighlightRange(select(el, 'one', 'four'), el), 'overlap')
  assert.equal(checkHighlightRange(select(el, 'two', 'two'), el), 'overlap')
  assert.equal(checkHighlightRange(select(el, 'three', 'four'), el), 'overlap')
  assert.equal(checkHighlightRange(select(el, 'four', 'four'), el), null)
})

test('rejects selections containing or inside images, tables and code blocks', () => {
  const el = article('<p>a <img src="x.png"> b</p><table><tr><td>cell</td></tr></table><pre><code>code here</code></pre><p>c <code>inline</code> d</p>')
  assert.equal(checkHighlightRange(select(el, 'a', 'b'), el), 'unsupported')
  assert.equal(checkHighlightRange(select(el, 'cell', 'cell'), el), 'unsupported')
  assert.equal(checkHighlightRange(select(el, 'code', 'here'), el), 'unsupported')
  assert.equal(checkHighlightRange(select(el, 'b', 'c'), el), 'unsupported')
  assert.equal(checkHighlightRange(select(el, 'c ', 'd'), el), null)  // inline code is fine
})

test('rejects selections crossing a list item boundary, allows within one item', () => {
  const el = article('<p>intro text</p><ul><li>first item</li><li>second item</li></ul>')
  assert.equal(checkHighlightRange(select(el, 'text', 'first'), el), 'crossesListItem')
  assert.equal(checkHighlightRange(select(el, 'item', 'second'), el), 'crossesListItem')
  assert.equal(checkHighlightRange(select(el, 'first', 'item'), el), null)
})

test('tightenRange: a triple-click range ending at the next block is shrunk to the paragraph', () => {
  const el = article('<p>last paragraph</p>\n<ul><li>item</li></ul><pre>code</pre>')
  const p = el.querySelector('p')!
  const li = el.querySelector('li')!
  const r = document.createRange()
  r.setStart(p.firstChild!, 0)
  r.setEnd(li.firstChild!, 0)
  assert.equal(checkHighlightRange(r, el), 'crossesListItem')  // untightened: wrong refusal
  const t = tightenRange(r)!
  assert.equal(t.toString(), 'last paragraph')
  assert.equal(checkHighlightRange(t, el), null)
  const ms = wrapRange(t, { type: 'key', note: '' })
  assert.equal(ms.length, 1)
  assert.equal(convert(el.innerHTML).split('\n')[0], '[[chai:key][last paragraph]]')
})

test('tightenRange: ending at the start of an existing highlight is not an overlap', () => {
  const el = article('<p>one two</p><p>three four</p>')
  wrapRange(select(el, 'three', 'three'), { type: 'key', note: '' })
  const r = document.createRange()
  r.setStart(el.querySelector('p')!.firstChild!, 0)
  r.setEnd(el.querySelector('mark')!.firstChild!, 0)
  assert.equal(checkHighlightRange(tightenRange(r)!, el), null)
})

test('tightenRange: whitespace-only range gives null', () => {
  const el = article('<p>a</p>\n<p>b</p>')
  const r = document.createRange()
  r.setStart(el.querySelector('p')!.firstChild!, 1)
  r.setEnd(el.querySelectorAll('p')[1].firstChild!, 0)
  assert.equal(tightenRange(r), null)
})

test('a note bubble adds no text and is left out of the export', () => {
  const el = article('<p>one two three</p>')
  const [mark] = wrapRange(select(el, 'two', 'two'), { type: 'key', note: 'why' })
  const bubble = addNoteBubble(mark)!
  assert.equal(bubble.parentElement, mark)
  assert.equal(noteBubbleOf(mark.firstChild), bubble)
  assert.equal(el.textContent, 'one two three')
  const plain = articleHtmlForExport(el)
  assert.ok(!plain.includes('caom-chai-note'))
  assert.equal(convert(plain), '[[chai:key:why][two]]'.replace(/^/, 'one ') + ' three')
})

test('a highlight without a note gets no bubble', () => {
  const el = article('<p>one two three</p>')
  const [mark] = wrapRange(select(el, 'two', 'two'), { type: 'key', note: '' })
  assert.equal(addNoteBubble(mark), null)
})

test('inline code fully covered is wrapped whole, with the spaces around it, in one mark', () => {
  const el = article('<p>x 属于 <code>ctx.tools</code> ，模型属于 <code>ctx.llm</code> 。y</p>')
  const r = select(el, '属于', '。')
  assert.equal(checkHighlightRange(r, el), null)
  const ms = wrapRange(r, { type: 'key', note: '' })
  assert.equal(ms.length, 1)
  assert.equal(ms[0].querySelectorAll('code').length, 2)
  assert.equal(el.querySelector('p > code'), null)
  assert.equal(el.textContent, 'x 属于 ctx.tools ，模型属于 ctx.llm 。y')
  // The double space before 。 is issue001
  assert.equal(convert(el.innerHTML), 'x [[chai:key][属于 =ctx.tools= ，模型属于 =ctx.llm=  。]]y')
})

test('part of inline code is wrapped inside the code element', () => {
  const el = article('<p>a <code>ctx.tools</code> b</p>')
  const ms = wrapRange(select(el, 'tools', 'tools'), { type: 'key', note: '' })
  assert.equal(ms.length, 1)
  assert.equal(ms[0].parentElement!.tagName, 'CODE')
})

test('updateHighlight changes type and note on every piece, and moves the bubble', () => {
  const el = article('<p>a b</p><p>c d</p>')
  const ms = wrapRange(select(el, 'b', 'c'), { type: 'key', note: 'old' })
  addNoteBubble(ms[ms.length - 1])
  const id = ms[0].getAttribute('data-chai-id')!
  const bubble = updateHighlight(el, id, { type: 'idea', note: ' new  note ' })!
  assert.deepEqual(highlightPieces(el, id).map(m => m.getAttribute('data-chai-type')), ['idea', 'idea'])
  assert.equal(el.querySelectorAll('.caom-chai-note').length, 1)
  assert.equal(bubble.getAttribute('data-note'), 'new note')
  assert.match(convert(articleHtmlForExport(el)), /#\+BEGIN_CHAI :type idea :note "new note"/)
})

test('updateHighlight with an empty note drops the note and its bubble', () => {
  const el = article('<p>one two three</p>')
  const [m] = wrapRange(select(el, 'two', 'two'), { type: 'key', note: 'n' })
  addNoteBubble(m)
  assert.equal(updateHighlight(el, m.getAttribute('data-chai-id')!, { type: 'key', note: '' }), null)
  assert.equal(el.querySelector('.caom-chai-note'), null)
  assert.equal(convert(articleHtmlForExport(el)), 'one [[chai:key][two]] three')
})

test('removeHighlight restores the original markup', () => {
  const before = '<p>x 属于 <code>ctx.tools</code> ，<em>y</em> z</p><p>w</p>'
  const el = article(before)
  const ms = wrapRange(select(el, '属于', 'w'), { type: 'key', note: 'n' })
  addNoteBubble(ms[ms.length - 1])
  removeHighlight(el, ms[0].getAttribute('data-chai-id')!)
  assert.equal(el.innerHTML, before)
  assert.equal(el.querySelector('p')!.childNodes[0].nodeValue, 'x 属于 ')
})
